'use strict'

/* eslint-env mocha */

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const {createSwarm} = require('./utils')
const {map, parallel} = require('async')

describe('dial', () => {
  let swarms
  before(done => {
    map([0, 1], (id, cb) => createSwarm(cb, true, id), (err, res) => {
      if (err) return done(err)
      swarms = res.map(r => {
        let [swarm, star] = r
        swarm.star = star
        return swarm
      })
      done()
    })
  })

  it('peers can discover each other', done => {
    parallel(swarms.map(swarm => cb => {
      swarm.star.listener.once('peers', peers => {
        expect(peers).to.have.lengthOf(2)
        cb()
      })
    }), done)
  })

  it('peers can dial each other', done => {
    parallel(swarms.map(swarm => cb => {
      swarm.star.discovery.on('peer', peer => {
        swarm.dial(peer, '/ipfs/ping/1.0.0', cb)
      })
    }), done)
  })

  after(done => parallel(swarms.map(swarm => cb => swarm.stop(cb)), done))
})
