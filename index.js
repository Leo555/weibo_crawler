/**
 * Created by LILE8 on 10/17/2016.
 */
'use strict';
var cron = require('cron');
var startJob = require('./dailyPost.js').startJob;


var job = cron.job('*/30 * * * * *', ()=> {
    startJob()
});

job.startJob();