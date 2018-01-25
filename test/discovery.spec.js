'use strict'

/* eslint-env mocha */

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const {createSwarm} = require('./utils')

describe('discovery', () => {
  let swarm
  let star
  before(done => createSwarm((err, res) => err ? done(err) : done(null, ([swarm, star] = res)), true))

  it('can discover peers', done => {
    star.listener.once('peers', peers => {
      expect(peers).to.have.lengthOf(1)
      done()
    })
  })

  after(done => swarm.stop(done))
})
