import {ec} from 'elliptic'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import * as _ from 'lodash'
import { Transaction, TxIn, TxOut, UnspentTxOut, getPublicKey, getTransactionId, signTxIn } from './transaction'
require('dotenv').config()

const EC = new ec('secp256k1')
const privateKeyLocation = __dirname + (process.env.PRIVATE_KEY_LOCATION || '/node/wallet/private_key')

const generatePrivateKey = ():string => {
    const keyPair = EC.genKeyPair()
    const privateKey = keyPair.getPrivate()
    return privateKey.toString(16)
}

const getPrivateKeyFromWallet = (): string => {
    const buffer = readFileSync(privateKeyLocation, 'utf8')
    return buffer.toString()
}

const getPublicFromWallet = (): string => {
    console.log('The location of private: ' + privateKeyLocation)
    const privateKey = getPrivateKeyFromWallet()
    const key = EC.keyFromPrivate(privateKey, 'hex')
    return key.getPublic().encode('hex')
}

const deleteWallet = () => {
    if (existsSync(privateKeyLocation)) {
        unlinkSync(privateKeyLocation)
    }
}

const initWallet = () => {
    if (existsSync(privateKeyLocation)) {
        return
    }
    const newPrivateKey = generatePrivateKey()

    writeFileSync(privateKeyLocation, newPrivateKey)
    console.log('new wallet with private key created')
}

const getBalance = (address: string, unspentTxOuts: UnspentTxOut[]): number => {
    return _(unspentTxOuts)
        .filter((uTxO: UnspentTxOut) => uTxO.address === address)
        .map((uTxO: UnspentTxOut) => uTxO.amount)
        .sum()
}

const findUnspentTxOuts = (ownerAddress: string, unspentTxOuts: UnspentTxOut[]) => {
    return _.filter(unspentTxOuts, (uTxO: UnspentTxOut) => uTxO.address === ownerAddress)
}

const findTxOutsForAmount = (amount: number, myUnspentTxOuts: UnspentTxOut[]) => {
    let currentAmount = 0
    const includedUnspentTxOuts = []
    for (const myUnspentTxOut of myUnspentTxOuts) {
        includedUnspentTxOuts.push(myUnspentTxOut)
        currentAmount += myUnspentTxOut.amount
        if (currentAmount >= amount) {
            const leftOverAmount = currentAmount - amount
            return {includedUnspentTxOuts, leftOverAmount}
        }
    }
    throw Error('not enough coins to send transaction');
}

const createTxOuts = (receiverAddres: string, myAddress: string, amount, leftOverAmount: number) => {
    const txOut1: TxOut = new TxOut(receiverAddres, amount)
    if (leftOverAmount === 0) {
        return [txOut1]
    } else {
        const leftOverTx = new TxOut(myAddress, leftOverAmount)
        return [txOut1, leftOverTx]
    }
}

const filterTxPoolTxs = (unspentTxOuts: UnspentTxOut[], transactionPool: Transaction[]): UnspentTxOut[] => {
    const txIns: TxIn[] = _(transactionPool)
        .map((tx: Transaction) => tx.txIns)
        .flatten()
        .value()
    
    const removable: UnspentTxOut[] = []
    for (const unspentTxOut of  unspentTxOuts) {
        const txIn = _.find(txIns, (aTxIn: TxIn) => {
            return aTxIn.txOutIndex === unspentTxOut.txOutIndex && aTxIn.txOutId === unspentTxOut.txOutId
        })

        if (txIn === undefined) {

        } else {
            removable.push(unspentTxOut)
        }
    }

    return _.without(unspentTxOuts, ...removable)
}

const createTransaction = (receiverAddress: string, amount: number, privateKey: string, unspentTxOuts: UnspentTxOut[], txPool: Transaction[]): Transaction => {
    const myAddress: string = getPublicKey(privateKey)
    const myUnspentTxOutsA: UnspentTxOut[] = unspentTxOuts.filter((uTxO: UnspentTxOut) => uTxO.address === myAddress)

    const myUnspentTxOuts = filterTxPoolTxs(myUnspentTxOutsA, txPool)

    const {includedUnspentTxOuts, leftOverAmount} = findTxOutsForAmount(amount, myUnspentTxOuts)

    const toUnsignedTxIn = (unspentTxOut: UnspentTxOut) => {
        const txIn: TxIn = new TxIn()
        txIn.txOutId = unspentTxOut.txOutId
        txIn.txOutIndex = unspentTxOut.txOutIndex
        return txIn
    }

    const unsignedTxIns: TxIn[] = includedUnspentTxOuts.map(toUnsignedTxIn)

    const tx: Transaction = new Transaction()
    tx.txIns = unsignedTxIns
    tx.txOuts = createTxOuts(receiverAddress, myAddress, amount, leftOverAmount)
    tx.id = getTransactionId(tx)

    tx.txIns = tx.txIns.map((txIn: TxIn, index: number) => {
        txIn.signature = signTxIn(tx, index, privateKey, unspentTxOuts)
        return txIn
    })

    return tx
}

export {createTransaction, getPublicFromWallet, getPrivateKeyFromWallet, 
    getBalance, generatePrivateKey, initWallet, deleteWallet, findUnspentTxOuts}