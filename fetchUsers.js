/**
 * Created by Leo on 2016/10/1.
 */
"use strict";
var os = require('os'),
    moment = require('moment'),
    iconv = require('iconv-lite'), //字符集转,
    monk = require('monk'),
    Request = require('request'),
    RsaEncrypt = require("./rsa").RSAKey,
    async = require('async'),
    _ = require('lodash'),
    cheerio = require('cheerio'),
    cookieColl = Request.jar(),
    request = Request.defaults({
        jar: cookieColl
    }),
    loginMsg = require('./config.js').loginMsg;

var connection_string = '127.0.0.1:27017/weiboSina',
    db = monk(connection_string),
    cachedUsers = {},
    timeFormat = 'YYYY-MM-DD HH:mm:ss',
    userCnt = 0;

function saveUser(user) {
    var userColl = db.get("users");
    userColl.insert(user);
}


function getJsonObj(body) {
    var start = body.indexOf("{");
    var end = body.lastIndexOf("}");
    var jsonStr = body.substr(start, end - start + 1);
    var responseJson = JSON.parse(jsonStr);
    return responseJson;
}

function getFansRecur(userId) {
    //新浪限制只能取每人前5页的fans
    for (var i = 1; i < 5; i++) {
        var fansUrl = "http://weibo.com/" + userId + "/follow?page=" + i;

        request({
            "uri": fansUrl,
            "encoding": "utf-8"
        }, function (err, response, body) {
            if (err) {
                console.log(err);
            } else {
                var userLst = getUserLst(body, userId);

                if (userLst) {
                    userLst.map(function (item) {
                        getFansRecur(item.uId);
                    });
                }
            }
        });

    }
}

function getUserLst(htmlContent, userId) {
    var matched = htmlContent.match(/\"follow_list\s*\\\".*\/ul>/gm);

    if (matched) {
        var str = matched[0].replace(/(\\n|\\t|\\r)/g, " ").replace(/\\/g, "");
        var ulStr = "<ul class=" + str;

        var $ = cheerio.load(ulStr);

        var myFans = [];
        $("li[action-data]").map(function (index, item) {
            var userInfo = getUserInfo($, this);
            if (userInfo && userInfo.uId.length === 10) {
                if (!cachedUsers[userInfo.uId]) {
                    userInfo.from = userId; //设置来源用户
                    cachedUsers[userInfo.uId] = true;
                    userInfo.createTime = moment().format(timeFormat);
                    userInfo.updateBy = os.hostname();
                    userInfo.lastFetchTime = moment().subtract(1, 'days').format(timeFormat);
                    userInfo.lastFetchResult = false;
                    userInfo.tryCount = 0;
                    log(++userCnt);
                    saveUser(userInfo);
                    myFans.push(userInfo);
                } else {
                    console.log("duplicate users");
                }
            }
        });

        return myFans;
    }

    return null;
}

function getUserInfo($, liSelector) {
    var liActionData = $(liSelector).attr("action-data").split("&");
    var sex = "unknown";

    if (liActionData.length == 3) {
        sex = liActionData[2].split("=")[1];
    }
    return {
        name: liActionData[1].split("=")[1],
        uId: liActionData[0].split("=")[1],
        sex: sex
    };
}

function tryParseInt(str) {
    try {
        return parseInt(str);
    } catch (e) {
        console.log("parseInt failed.");
        return 0;
    }
}

function log(msg) {
    console.log(msg);
}

function start() {
    var userName = loginMsg.userName;
    var password = loginMsg.password;

    var preLoginUrl = "http://login.sina.com.cn/sso/prelogin.php?entry=weibo&callback=sinaSSOController.preloginCallBack&su=&rsakt=mod&checkpin=1&client=ssologin.js(v1.4.11)&_=" + (new Date()).getTime();

    async.waterfall([
        function (callback) {
            request({
                "uri": preLoginUrl,
                "encoding": "utf-8"
            }, callback);
        },
        function (responseCode, body, callback) {
            var responseJson = getJsonObj(body);

            log(responseJson);
            log("Prelogin Success. ");

            var loginUrl = 'http://login.sina.com.cn/sso/login.php?client=ssologin.js(v1.4.18)';
            var loginPostData = {
                entry: "weibo",
                gateway: "1",
                from: "",
                savestate: "7",
                useticket: "1",
                vsnf: "1",
                su: "",
                service: "miniblog",
                servertime: "",
                nonce: "",
                pwencode: "rsa2",
                rsakv: "1330428213",
                sp: "",
                sr: "1366*768",
                encoding: "UTF-8",
                prelt: "282",
                url: "http://weibo.com/ajaxlogin.php?framelogin=1&callback=parent.sinaSSOController.feedBackUrlCallBack",
                returntype: "META"
            };

            loginPostData.su = new Buffer(userName).toString('base64');

            var rsaKey = new RsaEncrypt();
            rsaKey.setPublic(responseJson.pubkey, '10001');
            var pwd = rsaKey.encrypt([responseJson.servertime, responseJson.nonce].join("\t") + "\n" + password);

            loginPostData.sp = pwd;

            loginPostData.servertime = responseJson.servertime;
            loginPostData.nonce = responseJson.nonce;
            loginPostData.rsakv = responseJson.rsakv;

            request.post({
                "uri": loginUrl,
                "encoding": null, //GBK编码 需要额外收到处理,
                form: loginPostData

            }, callback);
        },
        function (responseCode, body, callback) {
            body = iconv.decode(body, "GBK");

            var errReason = /reason=(.*?)\"/;
            var errorLogin = body.match(errReason);

            if (errorLogin) {
                callback("登录失败,原因:" + errorLogin[1]);
            } else {
                var urlReg = /location\.replace\(\'(.*?)\'\)./;
                var urlLoginAgain = body.match(urlReg);

                if (urlLoginAgain) {

                    request({
                        "uri": urlLoginAgain[1],
                        "encoding": "utf-8"
                    }, callback);
                } else {
                    callback("match failed");
                }
            }
        },
        function (responseCode, body, callback) {
            console.log("登录完成");
            var responseJson = getJsonObj(body);

            var myfansUrl = "http://weibo.com/" + responseJson.userinfo.uniqueid + "/myfans";

            request({
                "uri": myfansUrl,
                "encoding": "utf-8"
            }, callback);

            var fansUrl = "http://weibo.com/{userId}/fans";
        },
        function (responseCode, body, callback) {
            console.log("开始分析... ");

            var userColl = db.get("users");
            var lastUid = "";
            console.log("查询已经记录的用户");
            var nIndex = 0;

            userColl.find({})
                .then((docs) => {
                    _.each(docs, function (doc) {
                        cachedUsers[doc.uId] = true;
                        if (doc.uId.length === 10)
                            lastUid = doc.uId;
                    });
                }).then(() => {
                console.log("已有用户已经缓存完成, 开始进行递归查询");
                console.log(lastUid);
                getFansRecur(lastUid || '2451227441');
            });
        }
    ], function (err) {
        console.log(err);
    });
}

start();