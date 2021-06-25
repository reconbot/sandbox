let http = require('http')
const makeRequestId = require('../../lib/request-id')
let invoke = require('../invoke-ws')
let Hashid = require('@begin/hashid')

/**
 * Handle handleshake and possibly return error; note:
 * - In APIGWv2, !2xx responses hang up and return the status code
 * - However, 2xx responses initiate a socket connection (automatically responding with 101)
 */
module.exports = function upgrade (wss, { cwd, inventory, update, connectedAt }) {
  let { get } = inventory

  return function upgrade (req, socket, head) {

    // Get the $connect Lambda
    let lambda = get.ws('connect')

    // Create a connectionId uuid
    let h = new Hashid()
    let connectionId = h.encode(Date.now())
    update.status('ws/connect: ' + connectionId)

    const requestContext = {
      routeKey: '$connect',
      eventType: 'CONNECT',
      messageDirection: 'IN',
      connectedAt,
      requestTimeEpoch: Date.now(),
      requestId: makeRequestId(),
      connectionId,
    }

    invoke({
      cwd,
      lambda,
      requestContext,
      req,
      inventory,
      update,
    },
    function connect (err, res) {
      let statusCode = res && res.statusCode
      if (err || !statusCode || typeof statusCode !== 'number') {
        update.verbose.status(`Error during WS upgrade (code: ${statusCode})`, JSON.stringify(err, null, 2), JSON.stringify(res, null, 2))
        socket.write(`HTTP/1.1 502 ${http.STATUS_CODES[502]}\r\n\r\n`)
        socket.destroy()
        return
      }
      else if (statusCode >= 200 && statusCode <= 208 || statusCode === 226) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', connectionId, ws)
        })
      }
      else {
        update.verbose.status(`Unclear what the situation is with this WS upgrade! (code: ${statusCode})`, JSON.stringify(res, null, 2))
        socket.write(`HTTP/1.1 ${statusCode} ${http.STATUS_CODES[statusCode]}\r\n\r\n`)
        socket.destroy()
        return
      }
    })
  }
}
