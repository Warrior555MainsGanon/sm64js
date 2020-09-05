const { App } = require('@sifrr/server')
const { MarioMsg, MarioListMsg } = require("./proto/mario_pb")
const port = 80

//// Sockets
const connectedSockets = {}

let currentId = 0
const generateID = () => {
    if (++currentId > 1000000) currentId = 0
    return currentId
}

const sendDataWithOpcode = (bytes, opcode, socket) => {
    const newbytes = new Uint8Array(bytes.length + 1)
    newbytes.set([opcode], 0)
    newbytes.set(bytes, 1)
    socket.send(newbytes, true)
}

const processPlayerData = (socket, bytes) => {
    try {
        const decodedMario = MarioMsg.deserializeBinary(bytes)
        const filteredMarios = Object.entries(connectedSockets).filter(([id, data]) => {
            return id != socket.id && data.valid > 10
        }).map(([id]) => { return connectedSockets[id].protomsg })

        const mariolistmsg = new MarioListMsg()
        mariolistmsg.setMarioList(filteredMarios)
        //socket.send(mariolistmsg.serializeBinary(), true)
        sendDataWithOpcode(mariolistmsg.serializeBinary(), 0, socket)

        //Pretty strict validation
        for (let i = 0; i < 3; i++) {
            if (isNaN(decodedMario.getPosList()[i])) return
            if (isNaN(decodedMario.getAngleList()[i])) return
        }
        if (isNaN(decodedMario.getAnimframe())) return
        if (isNaN(decodedMario.getAnimid()) || 0 > decodedMario.getAnimid()) return
        if (isNaN(decodedMario.getSkinid()) || 0 > decodedMario.getSkinid() || decodedMario.getSkinid() > 9) return
        decodedMario.setPlayername(String(decodedMario.getPlayername()).substring(0, 14))
        decodedMario.setSocketid(socket.id)

        /// Data is Valid
        const valid = connectedSockets[socket.id] ? ++connectedSockets[socket.id].valid : 0
        connectedSockets[socket.id] = { valid, protomsg: decodedMario, socket }
        clearTimeout(socket.mariodataTimeout)
        socket.mariodataTimeout = setTimeout(() => { connectedSockets[socket.id].valid = 0 }, 500)
    } catch (err) { console.log(err) }
}


const processKickAttack = (bytes) => {
    const kickMsg = JSON.parse(new TextDecoder("utf-8").decode(bytes))
    const responseMsg = new TextEncoder("utf-8").encode(JSON.stringify({ angle: kickMsg.angle }))
    sendDataWithOpcode(responseMsg, 2, connectedSockets[kickMsg.id].socket)
}

const server = new App({}).ws('/*', {
    open: (socket) => { socket.id = generateID() },
    message: (socket, bytes) => {
        const opcode = Buffer.from(bytes)[0]
        switch (opcode) {
            case 0: processPlayerData(socket, bytes.slice(1)); break
            case 2: processKickAttack(bytes.slice(1)); break
            default: console.log("unknown opcode: " + opcode)
        }
    },
    close: (socket) => {
        clearTimeout(socket.mariodataTimeout)
        delete connectedSockets[socket.id]
    }
})

server.file('/', "dist/index.html").folder('/', "dist")

server.listen(port, () => { console.log('Starting') })






/////// necessary for server rom extraction

/*
const { promisify } = require('util')
const { spawn } = require('child_process')
const { v4: uuidv4 } = require('uuid')
const http = require('http')
const fs = require('fs')

server.get('/romTransfer', async (req, res) => {
    console.log("rom transfer")

    const uid = uuidv4()
    await mkdir('extractTools/' + uid)

    const file = fs.createWriteStream('extractTools/' + uid + '/baserom.us.z64')
    await fileDownload(file, 'http://' + req.query.romExternal)

    res.send(await extractJsonFromRomFile(uid))
})

const mkdir = promisify(fs.mkdir)

const pythonExtract = (dir) => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawn('python3', ['extract_assets.py', 'us', dir], { cwd: 'extractTools/' })
        //pythonProcess.stdout.on('data', (data) => { console.log(data.toString()) })
        //pythonProcess.stderr.on('data', (data) => { console.log(data.toString()) })
        pythonProcess.stderr.on('close', () => { resolve() })
    })
}

const fileDownload = (file, url) => {
    return new Promise((resolve, reject) => {
        try {
            http.get(url, (response) => {
                const stream = response.pipe(file)
                stream.on('error', () => { reject('Fail') })
                stream.on('finish', () => { resolve() })
            })
        } catch {
            console.log("HTTP GET Error")
            fs.rmdirSync('extractTools/' + uid, { recursive: true })
            reject('Fail')
        }
    })
}

const extractJsonFromRomFile = async (dir) => {
    return new Promise(async (resolve, reject) => {
        try {
            await pythonExtract(dir)

            const extractedData = {}
            const assets = JSON.parse(fs.readFileSync('extractTools/assets.json'))
            Object.keys(assets).forEach((assetname) => {
                let filepath = assetname
                if (filepath == '@comment') return
                if (filepath.indexOf("skyboxes") != -1) { /// skybox
                    filepath = `extractTools/${dir}/${filepath}`
                    filepath = filepath.slice(0, filepath.length - 4) + "_skybox.c"
                    let filedata = fs.readFileSync(filepath, "utf8")
                    filedata = filedata.replace(/\r/g, "")
                    let lines = filedata.split("\n")
                    lines = lines.filter(line => (line.length != 0) && (line[0] != '/'))
                    while (lines.length > 0) {
                        let section = lines.splice(0, 2)
                        if (section[0].slice(0, 24) == 'ALIGNED8 static const u8') {
                            const textureName = section[0].slice(25, section[0].length - 6)
                            const textureData = section[1].slice(0, section[1].indexOf('}'))
                            extractedData[textureName] = Buffer.from(textureData.split(','))
                        }
                    }
                } else {  /// not skybox
                    filepath = `extractTools/${dir}/${filepath}`
                    filepath = filepath.substring(0, filepath.length - 4)
                    const filedata = fs.readFileSync(filepath)
                    extractedData[assetname] = filedata
                }
            })
            fs.rmdirSync('extractTools/' + dir, { recursive: true })
            resolve(extractedData)
        } catch {
            console.log('Rom Extraction Fail')
            fs.rmdirSync('extractTools/' + dir, { recursive: true })
            resolve('Fail')
        }
    })
}*/