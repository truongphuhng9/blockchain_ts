import * as express from 'express'
import * as bodyPaser from 'body-parser'

import {Block, generateNextBlock, getBlockchain} from './blockchain'
import {connectToPeers, getSockets, initP2PServer} from './p2p'

const httpPort: any = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort: any = parseInt(process.env.P2P_PORT) || 6001

const initHttpServer = (httpPort: number) => {
    const app = express()
    app.use(bodyPaser.json())

    app.get('/blocks', (req, res) => {
        res.send(getBlockchain())
    })

    app.post('/mine-block', (req, res) => {
        const newBlock: Block = generateNextBlock(req.body.data)
        res.send(newBlock)
    })

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort))
    })

    app.post('/add-peer', (req, res) => {
        connectToPeers(req.body.peer)
        res.send();
    })

    app.listen(httpPort, () => {
        console.log('listening http on port: ' + httpPort)
    })
}

initHttpServer(httpPort)
initP2PServer(p2pPort)