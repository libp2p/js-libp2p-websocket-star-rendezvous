'use strict'

const EE = require('events').EventEmitter
const mh = require('multihashes')

const debug = require('debug')
const log = debug('rendezvous-server:table')

module.exports = class PeerTable extends EE {
  constructor (opt) {
    super()
    Object.assign(this, opt)
    this.byId = {}
    this.discoveryBinary = []
    this.swarm.once('stop', () => this.stop())
  }

  stop () {
    log('stopping all connections')
    Object.keys(this.byId).forEach(id => this.remove(id))
  }

  _updateDiscovery () {
    if (this.rebuildOnNextTimeout) return
    this.rebuildOnNextTimeout = setTimeout(() => {
      this.rebuildOnNextTimeout = false
      this.discoveryBinary = Object.keys(this.byId).map(id => mh.fromB58String(id))
    }, this.discoveryUpdateInterval)
    if (this.rebuildOnNextTimeout.unref) this.rebuildOnNextTimeout.unref()
    this.emit('discoveryUpdated')
  }

  get (id) {
    return this.byId[id]
  }

  remove (peer) {
    if (!peer.id) this.get(peer)
    if (!peer) return
    const id = peer.id.toB58String()
    log('remove %s', id)
    peer._disconnect(true)
  }

  add (peer) {
    const id = peer.id.toB58String()
    log('adding %s', id)
    if (this.byId[id]) this.remove(peer)
    this.byId[id] = peer
    peer.discoveryInterval = setInterval(() => {
      peer.doDiscovery(this.discoveryBinary)
    }, this.discoveryInterval)
    peer.once('disconnect', () => {
      log('disconnect %s', id)
      delete this.byId[id]
      clearInterval(peer.discoveryInterval)
      this._updateDiscovery()
    })
    this._updateDiscovery()
    peer.doDiscovery(this.discoveryBinary)
  }
}
