/**
 * Created by Leo on 2016/10/1.
 */
'use strict';
var Request = require('request'),
    weiboLoginModule = require("./weiboLogin"),
    connection_string = '127.0.0.1:27017/weiboSina',
    monk = require('monk'),
    moment = require('moment'),
    db = monk(connection_string),
    Promise = require('bluebird'),
    _ = require('lodash'),
    cheerio = require('cheerio'),
    loginMsg = require('./config').loginMsg,
    feedsReg = /feed_list\'.*<\/script>/,
    rstEndFlag = '"})</script>',
    fetchCnt = 0,
    cookieColl = Request.jar();

function log(msg) {
    console.log(msg);
}

function getWeibo($, feedSelector) {
    var weiboDiv = $(feedSelector);

    var weiboInfo = {
        "tbinfo": weiboDiv.attr("tbinfo"),
        "mid": weiboDiv.attr("mid"),
        "isforward": weiboDiv.attr("isforward") === '1' ? 1 : 0,
        "text": weiboDiv.find(".WB_detail>.WB_text").text().trim(),
        "sendAt": weiboDiv.find(".WB_detail>.WB_from a").eq(0).attr("title")
    };

    if (weiboInfo.isforward) {
        var forward = weiboDiv.find("div[node-type=feed_list_forwardContent]");

        if (forward.length > 0) {
            var forwardUser = forward.find("a[node-type=feed_list_originNick]");

            var userCard = forwardUser.attr("usercard");

            weiboInfo.forward = {
                name: forwardUser.attr("nick-name"),
                id: userCard ? userCard.split("=")[1] : "error",
                text: forward.find(".WB_text").text().trim(),
                sendAt: forward.find(".WB_from a").eq(0).attr("title")
            };
        }
    }

    return weiboInfo;
}

function fetchUserWeibo(request, userId) {
    return new Promise((resolve, reject)=> {
        //var userUrl = 'http://www.weibo.com/' + userId + '?is_all=1';
        var userUrl = 'http://www.weibo.com/' + userId + '?profile_ftype=1&is_all=1#_0';
        request.get({url: userUrl}, function (err, response, body) {
            if (err) {
                log("微博内容查找失败:" + userUrl);
                reject(err);
            } else {
                var matchRst = body.match(feedsReg);
                if (matchRst) {
                    var htmlRst = '<div><div class="' + matchRst[0].substr(0, matchRst[0].length - rstEndFlag.length);
                    htmlRst = htmlRst.replace(/(\\n|\\t|\\r)/g, " ").replace(/\\/g, "");
                    var $ = cheerio.load(htmlRst);
                    var yesterday = moment().format('YYYY-MM-DD');
                    var dayBeforeYes = moment().subtract(1, 'days').format('YYYY-MM-DD');
                    var weiboInfos = [];
                    $("div[action-type=feed_list_item]").map(function (index, item) {
                        if ($(item).attr("feedtype") != "top") {
                            var weiboInfo = getWeibo($, item);
                            //get yesterday weibo
                            var sendTime = moment(weiboInfo.sendAt);
                            if (sendTime.isBetween(dayBeforeYes, yesterday)) {
                                weiboInfos.push(weiboInfo);
                            }
                        }
                    });
                    resolve(weiboInfos);
                    log("Completed:" + (fetchCnt++) + ", fetching:" + userId);
                }
                else {
                    log("微博内容查找失败:" + userUrl);
                    reject(new Error(userId));
                }
            }
        });
    });
}

function insertWeibo(weibo, uId) {
    var now = moment().format('YYYY-MM-DD HH:mm:ss');
    var dailyPost = db.get("dailyWeibo");
    var userColl = db.get("users");
    weibo.fetchTime = now;
    dailyPost.insert(weibo)
        .then(()=> {
            userColl.findOneAndUpdate({uId: uId}, {$set: {lastFetchTime: now, lastFetchResult: true}});
        });
}

function updateUserStatus(id, result, inc) {
    var userColl = db.get("users");
    var now = moment().format('YYYY-MM-DD HH:mm:ss');
    var update = {
        $set: {
            lastFetchTime: now,
            lastFetchResult: result
        }
    };
    if (inc) {
        update['$inc'] = {
            tryCount: 1
        };
    }
    userColl.findOneAndUpdate({uId: id}, update);
}

startJob()
function startJob() {
    console.log('start job');
    weiboLoginModule.login(loginMsg, function (err, cookieColl) {
        if (!err) {
            var request = Request.defaults({jar: cookieColl});
            var userColl = db.get("users");
            var now = moment().format('YYYY-MM-DD HH:mm:ss');
            var today = moment().format('YYYY-MM-DD');
            userColl.find({lastFetchTime: {$lte: today + ' 00:00:00'}}, {
                    limit: 200,
                    sort: {lastFetchTime: 1}
                })
                .each((doc)=> {
                    if (doc.uId.length === 10) {
                        return fetchUserWeibo(request, doc.uId)
                            .then((weibos)=> {
                                var tasks = [];
                                _.each(weibos, (w)=> {
                                    tasks.push(insertWeibo(w, doc.uId))
                                });
                                if (_.isEmpty(weibos)) {
                                    updateUserStatus(doc.uId, true);
                                }
                                Promise.all(tasks);
                            })
                            .catch((e)=> {
                                updateUserStatus(doc.uId, false);
                            });
                    } else {
                        updateUserStatus(doc.uId, true);
                    }
                });
        }
    });
}

function startRecoverJob() {
    console.log('start Recover Job');
    weiboLoginModule.login(loginMsg, function (err, cookieColl) {
        if (!err) {
            var request = Request.defaults({jar: cookieColl});
            var userColl = db.get("users");
            var now = moment().format('YYYY-MM-DD HH:mm:ss');
            var today = moment().format('YYYY-MM-DD');
            userColl.find({lastFetchTime: {$gte: today + ' 00:00:00'}, lastFetchResult: false, tryCount: {$lt: 5}}, {
                    limit: 200,
                    sort: {lastFetchTime: 1}
                })
                .each((doc)=> {
                    if (doc.uId.length === 10) {
                        fetchUserWeibo(request, doc.uId)
                            .then((weibos)=> {
                                var tasks = [];
                                _.each(weibos, (w)=> {
                                    tasks.push(insertWeibo(w, doc.uId))
                                });
                                if (_.isEmpty(weibos)) {
                                    updateUserStatus(doc.uId, true);
                                }
                                Promise.all(tasks);
                            })
                            .catch((e)=> {
                                updateUserStatus(doc.uId, false, true);
                            });
                    } else {
                        updateUserStatus(doc.uId, false, true);
                    }
                });
        }
    });
}


module.exports = {
    startJob: startJob,
    startRecoverJob: startRecoverJob
};