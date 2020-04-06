# SamlOpenstackWrapper (soswrap)

This library is a partial adaptation of [openstack cli implementation of saml2 authentication workflow](https://github.com/openstack/keystoneauth/blob/c096099416013414cb476e17b6bcfcbabee3856e/keystoneauth1/extras/_saml2/v3/saml2.py).

## Usage

```javascript
const { SamlOpenstackWrapper } = require('./main')
const got = require('got')

const main = async () => {
  const wrapper = new SamlOpenstackWrapper({
    idPName   : IDP_NAME,
    idPProto  : IDP_PROTOCOL,   // 'mapped'
    idPUrl    : IDP_URL,        // should end with /saml
    authUrl   : AUTH_URL,       // should end with /v3
  })

  wrapper.username = USERNAME
  wrapper.password = PASSWORD

  try {
    const token = await wrapper.getScopedToken({ projectId: PROJECT_ID })
    await got(`https://${SWIFT_HOST}/v1/${PATH_TO_CONTAINER}/${CONTAINER_ID}/${FILE_PATH}`, {
      method: 'PUT',
      headers: {
        'X-Auth-Token': token
      },
      body: FILE_CONTENT
    })
    console.log(token)
  } catch (e) {
    console.log(e)
  }
}

main()
```

## License

MIT