'use strict'

const defaults = {
  discoveryInterval: 10000, // 10s
  discoveryUpdateInterval: 1000 // 1s
}

const debug = require('debug')
const log = debug('signalling-server')

const PeerTable = require('./table')
const Peer = require('./peer')

module.exports = class SingnallingServer {
  constructor (opt) {
    this.opt = Object.assign(Object.assign({}, defaults), opt || {}) // clone defaults and assign opt's values to it
    Object.assign(this, opt) // laziness ftw

    this.table = new PeerTable(opt)

    this.swarm.handle('/ws-star/2.0.0', (proto, conn) => {
      conn.getPeerInfo((err, peer) => {
        if (err) return log(err)
        conn.getObservedAddrs((err, addrs) => {
          if (err) return log(err)
          this.handle(proto, peer, addrs, conn)
        })
      })
    })
  }

  handle (proto, peer, addrs, conn) {
    log('client connected: %s (addrs: %o)', peer.id.toB58String(), addrs)
    peer = new Peer(proto, peer, addrs, conn, this.table)
    peer.identify(log)
  }
}
