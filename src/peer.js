'use strict'

const EE = require('events').EventEmitter

const {IdentifyRequest, IdentifyResponse, DiscoveryEvent, DiscoveryACK} = require('./proto') // TODO: move to client
const lp = require('pull-length-prefixed')
const Pushable = require('pull-pushable')
const pull = require('pull-stream')

const equal = require('assert').deepEqual

const debug = require('debug')
const log = debug('signalling-server:peer')

const uuid = require('uuid')

module.exports = class Peer extends EE {
  constructor (proto, pi, conn, table) {
    super()
    Object.assign(this, pi)
    Object.assign(this, {proto, conn, table})

    this.nonce = uuid()

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
    this.source.abort(err)
    this.disconnected = err
    this.emit('disconnect', err)
  }

  sink (read) {
    let first = true
    const next = (err, data) => {
      if (this.disconnected) return read(this.disconnected)
      if (err) {
        this._disconnect(err)
        return read(err)
      }
      // data is binary protobuf. first packet is IdentifyResponse, after that DiscoveryACK
      try {
        if (first) {
          first = false
          const response = this.identifyResponse = IdentifyResponse.decode(data)
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
  }

  doDiscovery (id) {
    this.source.push(DiscoveryEvent.encode({id}))
  }

  identify (cb) {
    const {nonce, id} = this
    this.identifyRequest = IdentifyRequest.encode({nonce})
    this._push(this.identifyRequest)
    this.on('identifyResponse', response => {
      try {
        const otherID = {
          id: response.id,
          pubkey: response.pubkey
        }

        equal(id.toJSON(), otherID, 'ID not matching: Possible spoof!')

        id.pubkey.verify(nonce, response.signature, (err, res) => {
          if (!err && !res) err = new Error('Signature invalid!')
          if (err) {
            log('error during %s/identify: %s', id.toB58String(), err)
            this._disconnect(err)
            return cb(err)
          }

          // you shall pass

          this.table.add(this)
        })
      } catch (e) {
        log('error during %s/identify: %s', id.toB58String(), e)
        this._disconnect(e)
        return cb(e)
      }
    })
  }
}
