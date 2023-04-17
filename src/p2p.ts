import * as WebSocket from 'ws';
import {Server} from 'ws';
import {addBlockToChain, Block, getBlockchain, getLatestBlock, isValidBlockStructure, replaceChain, handleReceivedTransaction } from './blockchain';
import { getTransactionPool } from './transactionPool';
import { Transaction } from './transaction';

const sockets: WebSocket[] = []

const getSockets = () => sockets

enum MessageType {
    QUERY_LATEST = 0,
    QUERY_ALL = 1,
    RESPONSE_BLOCKCHAIN = 2,
    QUERY_TRANSACTION_POOL = 3,
    RESPONSE_TRANSACTION_POOL = 4
}

class Message {
    public type: MessageType
    public data: any
}

const initP2PServer = (port: number) => {
    const server: Server = new WebSocket.Server({port: port})
    server.on('connection', (ws: WebSocket) => {
        initConnection(ws)
    })
    console.log('listening websocket p2p port on: ' + port)
}

const initConnection = (ws: WebSocket) => {
    sockets.push(ws)
    initMessageHandler(ws)
    initErrorHandler(ws)
    write(ws, queryChainLengthMessage())

    setTimeout(() => {
        broadcast(queryTransactionPoolMessage())
    }, 500)
}

const JSONToObject = <T>(data: string): T | null => {
    try {
        return JSON.parse(data)
    } catch (e) {
        console.log(e)
        return null
    }
}

const initMessageHandler = (ws: WebSocket) => {
    ws.on('message', (data: string) => {
        try {
            const message: Message | null = JSONToObject<Message>(data)
            if (message === null) {
                console.log('could not parse received JSON message: ' + data)
                return
            }
            console.log('received message ' + JSON.stringify(message))
            switch (message.type) {
                case MessageType.QUERY_LATEST:
                    write(ws, responseLatestMessage())
                    break;
                case MessageType.QUERY_ALL:
                    write(ws, responseChainMessage())
                case MessageType.RESPONSE_BLOCKCHAIN:
                    const receivedBlocks: Block[] | null = JSONToObject<Block[]>(message.data)
                    if (receivedBlocks === null) {
                        console.log('invalid blocks received: ')
                        console.log(message.data)
                        break
                    }
                    handleBlockchainResponse(receivedBlocks)
                case MessageType.QUERY_TRANSACTION_POOL:
                    write(ws, responseTransactionPoolMessage())
                    break
                case MessageType.RESPONSE_TRANSACTION_POOL:
                    const receivedTransactions: Transaction[] = JSONToObject<Transaction[]>(message.data)
                    if (receivedTransactions === null) {
                        console.log('invalid transaction received: %s', JSON.stringify(message.data))
                        break
                    }
                    receivedTransactions.forEach((tx: Transaction) => {
                        try {
                            handleReceivedTransaction(tx)
                            broadcastTransactionPool()
                        } catch (e) {
                            console.log(e.message)
                        }
                    })
                    break
            }
        } catch (e) {
            console.log(e)
        }
        
    })
}

const write = (ws: WebSocket, message: Message): void => ws.send(JSON.stringify(message))

const broadcast = (message: Message): void => sockets.forEach((socket) => write(socket, message))

const responseLatestMessage = (): Message => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([getLatestBlock()])
})

const responseChainMessage = () => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify(getBlockchain())
})

const queryAllMessage = () => ({
    'type': MessageType.QUERY_ALL,
    'data': null
})

const queryChainLengthMessage = () => ({
    'type': MessageType.QUERY_LATEST,
    'data': null
})

const queryTransactionPoolMessage = (): Message => ({
    'type': MessageType.QUERY_TRANSACTION_POOL,
    'data': null
})

const responseTransactionPoolMessage = (): Message => ({
    'type': MessageType.RESPONSE_TRANSACTION_POOL,
    'data': JSON.stringify(getTransactionPool())
})


const initErrorHandler = (ws: WebSocket) => {
    const closeConnection = (wss: WebSocket) => {
        console.log('connection failed to peer: ' + wss.url)
        sockets.splice(sockets.indexOf(wss), 1)
    }
    ws.on('close', () => closeConnection(ws))
    ws.on('error', () => closeConnection(ws))
}

const handleBlockchainResponse = (receivedBlocks: Block[]) => {
    if (receivedBlocks.length === 0) {
        console.log('received blockchain with 0 size')
        return
    }

    const latestBlockReceived: Block = receivedBlocks[receivedBlocks.length - 1]
    if (!isValidBlockStructure(latestBlockReceived)) {
        console.log('block structure not valid')
        return
    }
    const latestBlockHeld: Block = getLatestBlock()
    if (latestBlockReceived.index > latestBlockHeld.index) {
        console.log('blockchian is behind. We got :' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index)
        if (latestBlockHeld.hash === latestBlockReceived.previousHash) {
            if (addBlockToChain(latestBlockReceived)) {
                broadcast(responseLatestMessage())
            }
        } else if (receivedBlocks.length === 1) {
            console.log('We have to query the chain from our peer')
            broadcast(queryAllMessage())
        } else {
            console.log('received blockchain is longer than current blockchain')
            replaceChain(receivedBlocks)
        }
    } else {
        console.log('Received blockchain is not longer than received blockchain. Do nothing')
    }
}

const broadcastLatest = () => {
    broadcast(responseLatestMessage())
}

const broadcastTransactionPool = () => {
    broadcast(responseTransactionPoolMessage())
}

const connectToPeers = (newPeer: string): void => {
    const ws: WebSocket = new WebSocket(newPeer)
    ws.on('open', () => {
        initConnection(ws)
    })
    ws.on('error', () => {
        console.log('connection failed')
    })
}

export { connectToPeers, broadcastLatest, broadcastTransactionPool, initP2PServer, getSockets };