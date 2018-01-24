'use strict'

const EE = require('events').EventEmitter
const mh = require('multihashes')

const debug = require('debug')
const log = debug('signalling-server:table')

module.exports = class PeerTable extends EE {
  constructor (opt) {
    super()
    Object.assign(this, opt)
    this.byId = {}
    this.discoveryBinary = []
  }

  _updateDiscovery () {
    if (this.rebuildOnNextTimeout) return
    this.rebuildOnNextTimeout = setTimeout(() => {
      this.rebuildOnNextTimeout = false
      this.discoveryBinary = Object.keys(this.byId).map(id => mh.fromB58String(id))
    }, this.discoveryUpdateInterval)
    this.emit('discoveryUpdated')
  }

  get (id) {
    return this.byId[id]
  }

  add (peer) {
    const id = peer.id.toB58String()
    log('adding %s', id)
    if (this.byId[id]) throw new TypeError('Tried to override already connected peer ' + id)
    this.byId[id] = peer
    peer.discoveryInterval = setInterval(() => {
      peer.doDiscovery(this.discoveryBinary)
    }, this.discoveryInterval)
    peer.once('disconnect', () => {
      delete this.byId[id]
      clearInterval(this.discoveryInterval)
      this._updateDiscovery()
    })
    this._updateDiscovery()
    peer.doDiscovery(this.discoveryBinary)
  }
}
