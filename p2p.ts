import * as WebSocket from 'ws';
import {Server} from 'ws';
import {addBlockToChain, Block, getBlockchain, getLatestBlock, isValidBlockStructure, replaceChain} from './blockchain';

const sockets: WebSocket[] = []

enum MessageType {
    QUERY_LATEST = 0,
    QUERY_ALL = 1,
    RESPONSE_BLOCKCHAIN = 2,
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
        const message: Message | null = JSONToObject<Message>(data)
        if (message === null) {
            console.log('could not parse received JSON message: ' + data)
            return
        }
        console.log('received message ' + JSON.stringify(message))
        switch (message.type) {
            case MessageType.QUERY_LATEST:
                write(ws, resposeLatestMessage())
                break;
        }
    })
}

const write = (ws: WebSocket, message: Message): void => ws.send(JSON.stringify(message))

const broadcast = (message: Message): void => sockets.forEach((socket) => write(socket, message))

const resposeLatestMessage = (): Message => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([getLatestBlock()])
})

const initErrorHandler = (ws: WebSocket) => {
    const closeConnection = (wss: WebSocket) => {
        console.log('connection failed to peer: ' + wss.url)
        sockets.splice(sockets.indexOf(wss), 1)
    }
    ws.on('close', () => closeConnection(ws))
    ws.on('error', () => closeConnection(ws))
}

const broadcastLatest = () => {
    broadcast(resposeLatestMessage())
}

export { broadcastLatest, initP2PServer};