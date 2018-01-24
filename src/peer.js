'use strict'

const EE = require('events').EventEmitter

const {IdentifyRequest, IdentifyResponse, DiscoveryEvent, DiscoveryACK} = require('libp2p-websocket-star/src/proto')
const lp = require('pull-length-prefixed')
const Pushable = require('pull-pushable')
const pull = require('pull-stream')

const equal = require('assert').deepEqual

const debug = require('debug')

const uuid = require('uuid')

module.exports = class Peer extends EE {
  constructor (proto, pi, addrs, conn, table) {
    super()
    Object.assign(this, pi)
    Object.assign(this, {proto, conn, table, addrs})

    this.nonce = uuid()
    this.log = debug('rendezvous-server:peer#' + this.id.toB58String())

    this.source = Pushable()
    this.sink = this.sink.bind(this)
    this._push = this.source.push.bind(this.source)

    pull(
      conn,
      lp.decode(),
      this,
      lp.encode(),
      conn
    )
  }

  _disconnect (err) {
    // this.source.abort(err) // TODO: fix 'TypeError: this.source.abort is not a function'
    this.disconnected = err
    this.emit('disconnect', err)
  }

  sink (read) {
    let first = true
    const next = (err, data) => {
      if (this.disconnected) return read(this.disconnected)
      if (err) {
        this._disconnect(err)
        return read(true)
      }
      // data is binary protobuf. first packet is IdentifyResponse, after that DiscoveryACK
      try {
        if (first) {
          first = false
          const response = IdentifyResponse.decode(data)
          if (this.log.enabled) this.identifyResponse = response // debug
          this.emit('identifyResponse', response)
        } else {
          const ack = DiscoveryACK.decode(data)
          if (ack.ok) {
            this.lastPing = new Date().getTime()
            this.emit('ping', this.lastPing, ack)
          } else {
            throw new Error('Ping unsuccessfull!')
          }
        }
      } catch (e) {
        this._disconnect(e)
        return read(e)
      }

      read(null, next)
    }

    read(null, next)
  }

  doDiscovery (id) {
    this.source.push(DiscoveryEvent.encode({id}))
  }

  identify (cb) {
    const {nonce, id, log} = this
    log('sending identify')
    const request = IdentifyRequest.encode({nonce})
    if (log.enabled) this.identifyRequest = request
    this._push(request)
    this.on('identifyResponse', response => {
      log('processing response')
      try {
        const otherID = {
          id: response.id,
          pubKey: response.pubKey,
          privKey: undefined
        }

        equal(otherID, id.toJSON(), 'ID not matching: Possible spoof!')

        id.pubKey.verify(nonce, response.signature, (err, res) => {
          if (!err && !res) err = new Error('Signature invalid!')
          if (err) {
            log('error during identify: %s', err)
            this._disconnect(err)
            return cb(err)
          }

          // you shall pass

          this.table.add(this)
        })
      } catch (e) {
        log('error during identify: %s', e)
        this._disconnect(e)
        return cb(e)
      }
    })
  }
}
