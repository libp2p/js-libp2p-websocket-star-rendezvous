#!/usr/bin/env node

'use strict'

/* eslint-disable no-console */

const Server = require('./')
const Libp2p = require('libp2p')

const WS = require('libp2p-websockets')
const TCP = require('libp2p-tcp')
const MULTIPLEX = require('libp2p-multiplex')
const SPDY = require('libp2p-spdy')
const SECIO = require('libp2p-secio')

const inDocker = Boolean(process.env.DOCKERMODE)

const path = require('path')
const fs = require('fs')

const Peer = require('peer-info')
const Id = require('peer-id')

const argv = require('minimist')(process.argv.slice(2))

const config = {
  port: argv.port || argv.p || process.env.PORT || 9090,
  host: argv.host || argv.h || process.env.HOST || '0.0.0.0',
  genconf: argv.genconf || argv.g || process.env.GENCONF || false,
  metrics: false, // !(argv.disableMetrics || process.env.DISABLE_METRICS)
  config: argv.config || argv.c || process.env.CONFIG || path.join(inDocker ? '/data' : process.cwd(), 'config.json'),
  discoveryInterval: argv.discoveryInterval || argv.di || process.env.DISCOVERY_INTERVAL,
  discoveryUpdateInterval: argv.discoveryUpdateInterval || argv.di || process.env.DISCOVERY_UPDATE_INTERVAL
}

const die = (...msg) => {
  console.error('ERROR: ' + msg.shift(), ...msg)
  process.exit(2)
}

if (config.genconf) {
  if (fs.existsSync(config.config)) die('Config %s already exists! Not overwriting...', config.config)
  console.log('Creating %s...', config.config)
  Id.create((err, id) => {
    if (err) die('Failed to create ID: %s', id)
    fs.writeFileSync(config.config, JSON.stringify({
      id: id.toJSON()
    }, null, 2))
  })
  return
}

console.log('Launching...')

if (!fs.existsSync(config.config)) die('Config file %s not found', config.config)
let conf
try {
  conf = require(path.resolve(inDocker ? '/data' : process.cwd(), config.config))
} catch (e) {
  die('Error loading %s: %s', config.config, e)
}

if (!conf) die('Config format error: Not an object')
if (!conf.id) die('Config format error: No PeerId (.id) found!')

Id.createFromJSON(conf.id, (err, id) => {
  if (err) die('ID load error: %s', err)
  const peer = new Peer(id)
  if (conf.listen) console.warn('WARN: CLI argument port/host is overridden by config.listen')
  else conf.listen = ['/ip4/' + config.host + '/tcp/' + config.port + '/ws', '/ip4/' + config.host + '/tcp/' + (config.port + 1)]

  conf.listen.forEach(addr => peer.multiaddrs.add(addr))

  const modules = {
    transport: [
      new WS(),
      new TCP()
    ],
    connection: {
      muxer: [
        MULTIPLEX,
        SPDY
      ],
      crypto: [
        SECIO
      ]
    },
    discovery: []
  }

  const options = {
    enabled: true,
    hop: {
      enabled: true,
      active: true // active relay
    }
  }

  const swarm = new Libp2p(modules, peer, null, options)

  const sconf = {swarm}

  if (config.discoveryInterval) sconf.discoveryInterval = config.discoveryInterval // if discoveryInterval is undefined Object.assign() will still overwrite the default which causes trouble
  if (config.discoveryUpdateInterval) sconf.discoveryUpdateInterval = config.discoveryUpdateInterval // if discoveryUpdateInterval is undefined Object.assign() will still overwrite the default which causes trouble

  let server = new Server(sconf)

  swarm.start(err => {
    if (err) die('Starting swarm failed: %s', err)
    const table = server.table
    let peers = 0
    table.on('connect', id => {
      peers++
      console.log('%s connected! (peers=%s)', id, peers)
    })
    table.on('disconnect', id => {
      peers++
      console.log('%s disconnected! (peers=%s)', id, peers)
    })

    swarm.peerInfo.multiaddrs.toArray().map(a => a.toString()).forEach(addr => {
      console.log('Listening on %s', addr)
    })
  })
})
