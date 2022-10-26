/**
 * Settings for the API
 * @param {Object} settings
 * @param {Boolean} settings.debug Enable/Disable log prints
 * @param {String} settings.framework Framework to use, currently only supports qbus
 * 
 */
const settings = {
    debug: true,
    framework: 'qb-core'
}

//Do not edit unless you know what you are doing



const MoneyEX = new RegExp('^[0-9]+$');
const Mysql = require('@overextended/oxmysql');
const http = require('http');

let Framework = exports[settings.framework].GetCoreObject();

/**
 * Log a message to the server console with optional mode to turn it off
 * @param {String} msg 
 */
const log = (msg) => {
    if (settings.debug) {
        console.log("*****BEGIN DEBUG PRINT*****")
        console.log(msg);
        console.log("*****END DEBUG PRINT*****")
    }
}

//--HTTP functions--\\


/**
 * Create a server for the http router
 */
const server = http.createServer((req, res) => {
    // create a log for debugging purposes
    const query = new URL(req.url, `http://${req.headers.host}`).search.replace("?", "").split('=')[1];
    const request = {
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: query
    };
    log(`Request: {IP: ${request.ip}} {METHOD: ${request.method}} {URL: ${request.url}} {query: ${request.query}} {HEADERS: ${JSON.stringify(request.headers)}}`);
    // check the path
    Router(req, res);
});

/**
 * HTTP router for api
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} res 
 */
async function Router(req, res) {
    // get the query string
    const url = new URL(req.url, `http://${req.headers.host}`);
    const query = url.search.replace("?", "").split('=')[1];
    const path = url.pathname;
    if (!await CheckKey(query)) {
        res.writeHead(401);
        res.end("Request failed, invalid key");
        return;
    }

    // delete the key from the database
    await DeleteKey(query);


    switch (path.split('/')[1]) {
        case "revive":
            handleRevive(path, req, res)
            break;
        case "kill":
            HandleKill(path, req, res)
            break;
        case "money":
            HandleMoney(path, req, res)
            break;
        case "kickall":
            KickAll(path, res)
            break;
        case "kick":
            Kick(path, res)
            break;
        case "players":
            GetPlayers(res, req)
            break;
        case "ping":
            GetPing(path, res)
            break;
        case "playerdata":
            GetPlayerData(path, res)
            break;
        case "cuff":
            Cuff(path, res)
            break;
        case "ban":
            Ban(path, res)
            break;
        case "results":
            GetResults(res)
            break;
        case "time":
            SetTime(path,res)
            break;
        case "weather":
            SetWeather(path,res)
            break;
        default:
            res.writeHead(404);
            res.end("404. Path not found");
            return;
    }
}


//--SQL functions--\\

/**
 * Check if key is in the database
 * @param {String} key 
 */
async function CheckKey(key) {
    const result = await Mysql.oxmysql.query("SELECT `id` FROM `api` WHERE `key` = ?", [key]);
    if (result.length > 0) {
        return true;
    }
    return false;
}
/**
 * Remove the key from the database
 * @param {String} key 
 */
async function DeleteKey(key) {
    Mysql.oxmysql.query("DELETE FROM `api` WHERE `key` = ?", [key]);
}



//--Framework Functions--\\




//--Ziekenhuis--\\
/**
 * Revive for api
 * @param {String} path
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} res 
 */
function handleRevive(path, req, res) {
    let id = path.split('/')[2];
    emitNet("hospital:client:Revive", parseInt(id));
    res.end("Player revived")
    log(`player ${id} revived via API`)
    return;
}

/**
 * Kill for api
 * @param {String} path
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} res 
 */
function HandleKill(path, req, res) {
    let id = path.split('/')[2];
    emitNet("hospital:client:KillPlayer", parseInt(id));
    res.end("player killed")
    log(`player ${id} Killed via API`)
    return;
}

//--Speler geld beheer--\\
/**
 * 
 * @param {String} path 
 * @param {http.IncomingMessage} req 
 * @param {http.ServerResponse} res 
 */
function HandleMoney(path, req, res) {
    const ValidTypes = ["cash", "bank", "crypto"]
    let id = path.split('/')[2];
    let XPlayer = Framework.Functions.GetPlayer(parseInt(id));
    if (!XPlayer) {
        res.end("Player not found")
        return;
    }
    let money = path.split('/')[3];
    let type = path.split('/')[4];
    let moneytype = path.split('/')[5];
    if (!(money && type && moneytype)) {
        res.end("Invalid args")
        return;
    }


    if (!ValidTypes.includes(moneytype)) {
        res.end("Invalid args")
        return;
    }

    if (!MoneyEX.test(money)) {
        res.end("Invalid args")
        return;
    }

    if (type == "add") {
        XPlayer.Functions.AddMoney(moneytype, parseInt(money), "API Add Money");
        res.end("Added the money")
        log(`Player ${id} has been given ${money} via API`)

    } else {
        XPlayer.Functions.RemoveMoney(moneytype, parseInt(money), "API Remove Money");
        res.end("Removed the money")
        log(`Player ${id} has been taken ${money} via API`)

    }
    return;
}
/**
 * Kick alle spelers online
 * @param {String} path
 * @param {http.ServerResponse} res 
 */
function KickAll(path, res) {
    let reason1 = path.split('/')[2].replaceAll("_", " ");
    let reason = reason1.replaceAll("-", "/")

    if (!reason) {
        res.end("Invalid reason");
        return;
    }
    Framework.Functions.GetPlayers().forEach(source => {
        DropPlayer(source, `[Admin KickAll] ${reason}`);
    });
    res.end("Kicked everyone");
    log(`Kicked everyone`);
    return;

}

/**
 * Kick 1 specifieke speler
 * @param {String} path
 * @param {http.ServerResponse} res 
 */

function Kick(path, res) {
    let id = path.split('/')[2];
    let reason1 = path.split('/')[3].replaceAll("_", " ");
    let reason = reason1.replaceAll("-", "/")
    if (!reason) {
        res.end("Invalid reason");
        return;
    }
    if (!id) {
        res.end("Invalid player");
        return;
    }
    DropPlayer(id, `[Admin kick] ${reason}`);
    res.end("Player kicked");
    log(`Player ${id} kicked via API`);
    return;

}

//--Get Functions--\\

/**
 * Krijg alle spelers online
 * @param {http.ServerResponse} res
 * @param {http.IncomingMessage} req
*/
function GetPlayers(res, req) {
    let players = [];
    Framework.Functions.GetPlayers().forEach(source => {
        players.push(source);
    });
    res.end(JSON.stringify(players));
    log(`API requested players`)
    return;
}

/**
 * Check de ping van 1 speler
 * @param {String} path
 * @param {http.ServerResponse} res 
 */
function GetPing(path, res) {
    let id = path.split('/')[2];
    let ping = GetPlayerPing(id);
    res.end(JSON.stringify(ping));
    log(`Ping of speler ${id} requested by API`)
    return;
}

/**
 * Krijg de playerdata van 1 speler
 * @param {String} path
 * @param {http.ServerResponse} res
    */
function GetPlayerData(path, res) {
    let id = path.split('/')[2];
    let XPlayer = Framework.Functions.GetPlayer(parseInt(id));
    if (!XPlayer) {
        // Make sure the webpanel can still get some data even if the player doesn't exist. It's easier to do it JS side for me then PHP side
        res.end(JSON.stringify({
            charinfo : {
                firstname : "Speler",
                lastname : "Niet gevonden"
            },
            job : {
                label: "Niet gevonden",
                grade: {
                    name: "Niet gevonden",
                    level : 0
                }
            }
        }))
        return;
    }
    res.end(JSON.stringify(XPlayer.PlayerData));
    log(`Playerdata from player ${id} requested by API`)
    return;
}

/**
 * Cuff/Uncuff een speler
 * @param {String} path
 * @param {http.ServerResponse} res
 */
function Cuff(path, res) {
    let id = path.split('/')[2];
    emitNet("police:client:GetCuffed", id, true)
    res.end("Player Cuffed")
    log(`Player ${id} Cuffed via API`)
    return;
}

/**
 * Ban een speler
 * @param {String} path
 * @param {http.ServerResponse} res
 */
function Ban(path,res) {
    let id = path.split('/')[2];
    let reason1 = path.split('/')[3].replaceAll("_", " ");
    let reason = reason1.replaceAll("-", "/")
    let banTime = path.split('/')[4];
    if (!reason) {
        res.end("Invalid reason");
        return;
    }
    if (!id) {
        res.end("Invalid player");
        return;
    }

    let XPlayer = Framework.Functions.GetPlayer(parseInt(id));
    if (!XPlayer) {
        res.end("Player not found")
        return;
    }

    if (parseInt(banTime) > 2147483647) {
            banTime = '2147483647'
    }
    Mysql.oxmysql.insert('INSERT INTO bans (name, license, discord, ip, reason, expire, bannedby) VALUES (?, ?, ?, ?, ?, ?, ?)', [
        GetPlayerName(id),
        Framework.Functions.GetIdentifier(id, 'license'),
        Framework.Functions.GetIdentifier(id, 'discord'),
        Framework.Functions.GetIdentifier(id, 'ip'),
        reason,
        parseInt(banTime) * 60 * 60, // in hours
        "qb-api"
    ]);
    res.end("Player banned")
    DropPlayer(id, `[Admin ban] ${reason}`);

}


//--World settings--\\

/**
 * Stel server tijd in
 * @param {String} path
 * @param {http.ServerResponse} res
 */
function SetTime(path, res) {
    let hour = path.split('/')[2];
    let minute = path.split('/')[3];
    if (!hour) {
        res.end("Invalid hour");
        return;
    }
    if (!minute) {
        res.end("Invalid minute");
        return;
    }
    exports['qb-weathersync'].setTime(hour, minute);
    res.end("Time set");
    log(`Time set to ${hour}:${minute} via API`)
}


/**
 * Stel server weer in
 * @param {String} path
 * @param {http.ServerResponse} res
 */
 function SetWeather(path, res) {
    let type = path.split('/')[2];
    if(type === 'blackout') {


        exports['qb-weathersync'].setBlackout(!exports['qb-weathersync'].getBlackoutState());
        res.end("Weather set");
        log(`Blackout toggled via API`)

    } else {
        
    
        exports['qb-weathersync'].setWeather(type);
        res.end("Weather set");
        log(`weather set to ${type} via API`)
    }
}
//--Http listener--\\

/**
 * This sends an array of good results to the server so it can know if the result was positive or not
 * @param {http.ServerResponse} res
 */
function GetResults(res) {
    let goodresults = [
        "Player revived",
        "player killed",
        "Added the money",
        "Removed the money",
        "Player kicked",
        "Player Cuffed",
        "Player banned",  
        "Time set",
        "Weather set",
    ];
    res.end(JSON.stringify(goodresults));
}

server.listen(3000, () => {
    log('Server is running on port 3000');
});
