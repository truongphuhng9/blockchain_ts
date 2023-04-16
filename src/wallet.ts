import {ec} from 'elliptic'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import * as _ from 'lodash'

const EC = new ec('secp256k1')
const privateKeyLocation = 'node/wallet/private_key'

const generatePrivateKey = ():string => {
    const keyPair = EC.genKeyPair()
    const privateKey = keyPair.getPrivate()
    return privateKey.toString(16)
}

const initWallet = () => {
    if (existsSync(privateKeyLocation)) {
        return
    }

    const newPrivateKey = generatePrivateKey()

    writeFileSync(privateKeyLocation, newPrivateKey)
    console.log('new wallet with private key created')
}