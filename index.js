/**
 * Created by LILE8 on 10/17/2016.
 */
'use strict';
var cron = require('cron');
var startJob = require('./dailyPost.js').startJob;
var startRecoverJob = require('./dailyPost.js').startRecoverJob;

var job = cron.job('00 */1 * * * *', ()=> {
    startJob()
});

var recoverJob = cron.job('30 */2 * * * *', ()=> {
    startRecoverJob()
});

job.start();
recoverJob.start();