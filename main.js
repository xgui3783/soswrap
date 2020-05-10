const {
  filterTrailingSlash,
  XMLError,
  HttpError,
  HttpHeaderMissingError,
  HttpStatusError,
  ParameterMissingError,
  NotYetImplementedError,
} = require('./util')

const got = require('got')
const { CookieJar, Cookie } = require('tough-cookie')
const { promisify } = require('util')

const {
  SOSWRAP_UNSCOPED_TOKEN,
  SOSWRAP_SCOPED_TOKEN,
} = process.env

class SamlOpenstackWrapper{
  constructor({
    idPName,    // cscskc
    idPProto,   // mapped
    idPUrl,     // should end with /saml
    authUrl     // should end with /v3
  }){
    this.idPName = idPName
    this.idPProto = idPProto
    this.idPUrl = idPUrl
    this.authUrl = authUrl

    this.unscopedReqParam = [
      'idPName',
      'idPProto',
      'idPUrl',
      'authUrl',
      'username',
      'password', 
    ]

    this.scopedReqparam = [
      'authUrl'
    ]
  }

  set username(val) {
    this._username = val
  }
  get username() {
    return this._username
  }

  set password(pswd) {
    this._password = pswd
  }
  get password() {
    return this._password
  }

  checkUnscopedPrereq(){
    for (const prop of this.unscopedReqParam) {
      if (!this[prop]) throw new ParameterMissingError(`property ${prop} needs to be defined!`)
    }
  }

  async validateUnscopedToken(){

  }

  async getUnscopedToken(){

    if (SOSWRAP_UNSCOPED_TOKEN) return SOSWRAP_UNSCOPED_TOKEN

    this.checkUnscopedPrereq()

    const authUrl = `${filterTrailingSlash(this.authUrl)}OS-FEDERATION/identity_providers/${this.idPName}/protocols/${this.idPProto}/auth`

    const resp = await got(authUrl, {
      agent: false,
      method: 'GET',
      headers: {
        'accept': 'application/vnd.paos+xml',
        'PAOS': 'ver="urn:liberty:paos:2003-08";"urn:oasis:names:tc:SAML:2.0:profiles:SSO:ecp"'
      }
    })
    const { body } = resp

    const headerProg = /<\w+:Header.*?<\/\w+:Header>/
    const idpRequestBody = body.replace(headerProg, '')

    const basicAuthb64 = Buffer.from(`${this.username}:${this.password}`).toString('base64')

    const resp2 = await got(this.idPUrl, {
      agent: false,
      method: 'POST',
      headers: {
        'Content-type': 'text/xml',
        Authorization: `Basic ${basicAuthb64}`
      },
      body: idpRequestBody,
    })

    const { body: body2, headers: headers2 } = resp2

    const reProg = /<ecp\:Response.*?"(https:\/\/.*?)".*?(\/>|<\/ecp:Response>)/
    const re = reProg.exec(body2)
    if (!re) throw new XMLError(`ecp:Response url not found: ${body2}`)

    const re2 = /<ecp:RelayState.*?<\/ecp:RelayState>/.exec(body)
    if (!re2) throw new XMLError(`ecp:RelayState not found: ${body}`)

    const newBody = body2.replace(reProg, re2[0]).replace('s:mustUnderstand', 'SOAP-ENV:mustUnderstand')

    const mappedCookie = headers2['set-cookie'] instanceof Array
      ? headers2['set-cookie'].map(Cookie.parse.bind(Cookie))
      : [ Cookie.parse(headers2['set-cookie']) ]

    const finalUrl = re[1]

    const cookieJar = new CookieJar();
    const setCookie = promisify(cookieJar.setCookie.bind(cookieJar));

    for (const cookie of mappedCookie) {
      await setCookie(cookie.cookieString(), this.authUrl)
    }

    const final = await got(finalUrl, {
      agent: false,
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.paos+xml',
      },
      cookieJar,
      body: newBody
    })

    const { body: body3, headers:headers3, statusCode } = final

    if (statusCode >= 300) {
      throw new HttpStatusError(`
        statusCode: ${statusCode},
        header: ${JSON.stringify(headers3)},
        body: ${body3}`)
    }

    const unscoped = headers3['x-subject-token']
    if (!unscoped) {
      throw new HttpHeaderMissingError(`x-subject-token missing in header`)
    }

    this.unscopedToken = unscoped
    
    return unscoped
  }

  async getScopedToken({ projectId } = {}) {
    const pId = projectId || this.projectId
    if (!pId) throw new ParameterMissingError(`getScopedToken requires either object argument with projectId as key value or this.projectId to be set`)
    if (!this.authUrl) throw new ParameterMissingError(`getScopedToken requires this.authUrl to be set`)

    if (SOSWRAP_SCOPED_TOKEN) return SOSWRAP_SCOPED_TOKEN
    const token = await this.getUnscopedToken()
    const payload = {
      auth: {
        identity: {
          methods: [
            'token'
          ],
          token: {
            id: token
          }
        },
        scope: {
          project: {
            id: pId
          }
        }
      }
    }
    const resp = await got(`${this.authUrl}/auth/tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
  
    if (!resp.headers['x-subject-token']) {
      throw new HeaderMissionError(`x-subject-token missing header`)
    }
    this.scopedToken = resp.headers['x-subject-token']
  
    return this.scopedToken
  }

  async useProject(projectId) {
    if (!projectId) throw new ParameterMissingError(`useProject method needs projectId as argument`)
    this.projectId = projectId
    const token = await this.getScopedToken()
  }


  listProjects(){
    throw new NotYetImplementedError(`listProjects not yet implemented`)
  }
}

exports.SamlOpenstackWrapper = SamlOpenstackWrapper
