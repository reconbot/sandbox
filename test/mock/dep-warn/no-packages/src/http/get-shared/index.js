let shared = require('@architect/shared')

exports.handler = async function http (req) {
  return {
    statusCode: 200,
    body: 'Henlo'
  }
}
