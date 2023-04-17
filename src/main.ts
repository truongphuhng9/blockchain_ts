import * as express from 'express'
import * as bodyPaser from 'body-parser'

import {
    Block, generateRawNextBlock, generateNextBlock, getBlockchain, 
    getAccountBalance, generateNextBlockWithTransaction, sendTransaction,
    getUnspentTxOuts, getMyUnspentTransactionOutputs
} from './blockchain'
import {connectToPeers, getSockets, initP2PServer} from './p2p'
import {getTransactionPool} from './transactionPool'
import { getPublicFromWallet, initWallet } from './wallet';

const httpPort: any = parseInt(process.env.HTTP_PORT) || 3001;
const p2pPort: any = parseInt(process.env.P2P_PORT) || 6001

const initHttpServer = (httpPort: number) => {
    const app = express()
    app.use(bodyPaser.json())

    app.use((err, req, res, next) => {
        if (err) {
            res.status(400).send(err.message)
        }
    })

    app.get('/blocks', (req, res) => {
        res.send(getBlockchain())
    })

    app.get('/uTXOs', (req, res) => {
        res.send(getUnspentTxOuts());
    });

    app.get('/my-UTXOs', (req, res) => {
        res.send(getMyUnspentTransactionOutputs());
    });

    app.post('/mine-raw-block', (req, res) => {
        if (req.body.data == null) {
            res.send('data parameter is missing')
            return
        }
        const newBlock: Block = generateRawNextBlock(req.body.data)
        if (newBlock === null) {
            res.status(400).send('could not generate block')
        }
        res.send(newBlock)
    })

    app.post('/mine-block', (req, res) => {
        const newBlock: Block = generateNextBlock()
        if (newBlock === null) {
            res.status(400).send('could not generate block')
        }
        res.send(newBlock)
    })

    app.get('/balance', (req, res) => {
        const balance: number = getAccountBalance()
        res.send({'balance': balance})
    })

    app.get('/address', (req, res) => {
        const address: string = getPublicFromWallet()
        res.send({'address': address})
    })

    app.post('/mine-transaction', (req, res) => {
        const address = req.body.address
        const amount = req.body.amount
        try {
            const resp = generateNextBlockWithTransaction(address, amount)
            res.send(resp)
        } catch (e) {
            console.log(e.message)
            res.status(400).send(e.message)
        }
    })

    app.post('/send-transaction', (req, res) => {
        try {
            const address = req.body.address
            const amount = req.body.amount

            if (address === undefined || amount === undefined) {
                throw Error('invalid address or amount')
            }

            const resp = sendTransaction(address, amount)
            res.send(resp)
        } catch (e) {
            console.log(e.message)
            res.status(400).send(e.message)
        }
    })

    app.get('/transactionPool', (req, res) => {
        res.send(getTransactionPool())
    });

    app.get('/peers', (req, res) => {
        res.send(getSockets().map((s: any) => s._socket.remoteAddress + ':' + s._socket.remotePort))
    })

    app.post('/add-peer', (req, res) => {
        connectToPeers(req.body.peer)
        res.send();
    })

    app.post('/stop', (req, res) => {
        res.send({'msg': 'stopping server'})
        process.exit()
    })

    app.listen(httpPort, () => {
        console.log('listening http on port: ' + httpPort)
    })
}

initHttpServer(httpPort)
initP2PServer(p2pPort)
initWallet()