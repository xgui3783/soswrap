const filterTrailingSlash = str => `${str.replace(/\/*$/, '')}/`

class ParameterMissingError extends Error{
  constructor(reason) {
    super(reason)
  }
}

class XMLError extends Error{
  constructor(reason) {
    super(reason)
  }
}

class HttpError extends Error{
  constructor(reason) {
    super(reason)
  }
}

class HttpHeaderMissingError extends HttpError{
  constructor(reason){
    super(reason)
  }
}

class HttpStatusError extends HttpError{
  constructor(reason){
    super(reason)
  }
}

class NotYetImplementedError extends Error{}

module.exports = {
  filterTrailingSlash,
  XMLError,
  HttpError,
  HttpHeaderMissingError,
  HttpStatusError,
  NotYetImplementedError
}