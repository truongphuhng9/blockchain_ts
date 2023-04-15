import * as Crypto from 'crypto-js'
import * as ecdsa from 'elliptic'
import * as _ from 'lodash'

import { toHexString } from './utils'

const ec = new ecdsa.ec('secp256k1')

class TxOut {
    public address: string
    public amount: number

    constructor(address: string, amount: number) {
        this.address = address
        this.amount = amount
    }
}

class TxIn {
    public txOutId: string
    public txOutIndex: number
    public signature: string
}

class Transaction {
    public id: string
    public txIns: TxIn[]
    public txOuts: TxOut[]
}

class UnspentTxOut {
    public readonly txOutId: string
    public readonly txOutIndex: number
    public readonly address: string
    public readonly amount: number

    constructor(txOutId: string, txOutIndex: number, address: string, amount: number) {
        this.txOutId = txOutId
        this.txOutIndex = txOutIndex
        this.address = address
        this.amount = amount
    }
}

let unspentTxOuts: UnspentTxOut[] = []

const findUnspentTxOut = (transactionId: string, index: number, aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut | undefined => {
    return aUnspentTxOuts.find((uTxO) => uTxO.txOutId === transactionId && uTxO.txOutIndex === index)
}

const getTxInAmount = (txIn: TxIn, aUnspentTxOuts: UnspentTxOut[]): number | undefined => {
    return findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts)?.amount
}

const updateUnspentTxOuts = (newTransactions: Transaction[], aUnspentTxOuts: UnspentTxOut[]): UnspentTxOut[] => {
    const newUnspentTxOuts: UnspentTxOut[] = newTransactions
        .map((t) => {
            return t.txOuts.map((txOut, index) => new UnspentTxOut(t.id, index, txOut.address, txOut.amount))
        })
        .reduce((a, b) => a.concat(b), [])

    const consumedTxOuts: UnspentTxOut[] = newTransactions
        .map((t) => t.txIns)
        .reduce((a, b) => a.concat(b), [])
        .map((txIn) => new UnspentTxOut(txIn.txOutId, txIn.txOutIndex, '', 0))

    const resultingUnspentTxOuts = aUnspentTxOuts
        .filter((uTxO) => !findUnspentTxOut(uTxO.txOutId, uTxO.txOutIndex, consumedTxOuts))
        .concat(newUnspentTxOuts)

    return resultingUnspentTxOuts
}

const getTransactionId = (transaction: Transaction): string => {
    const txInContent: string = transaction.txIns
        .map((txIn: TxIn) => txIn.txOutId + txIn.txOutIndex)
        .reduce((a, b) => a + b, '')

    const txOutContent: string = transaction.txOuts
        .map((txOut: TxOut) => txOut.address + txOut.amount)
        .reduce((a, b) => a + b, '')

    return Crypto.SHA256(txInContent + txOutContent).toString()
}

const signTxIn = (transaction: Transaction, txInIndex: number, privateKey: string, aUnspentTxOuts: UnspentTxOut[]): string => {
    const txIn: TxIn = transaction.txIns[txInIndex]
    const dataToSign = transaction.id
    const referencedUnspentTxOut: UnspentTxOut = findUnspentTxOut(txIn.txOutId, txIn.txOutIndex, aUnspentTxOuts)
    const referencedAddress = referencedUnspentTxOut.address
    const key = ec.keyFromPrivate(privateKey, 'hex')
    const signature: string = toHexString(key.sign(dataToSign).toDER())
    return signature
}