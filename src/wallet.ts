import {ec} from 'elliptic'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import * as _ from 'lodash'
import { UnspentTxOut } from './transaction'

const EC = new ec('secp256k1')
const privateKeyLocation = 'node/wallet/private_key'

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
    const privateKey = getPrivateKeyFromWallet()
    const key = EC.getKeyFromPrivate(privateKey, 'hex')
    return key.getPublic().encode('hex')
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