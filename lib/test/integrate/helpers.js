"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var src_1 = require("../../src");
var sampleData = require('../fixture/integrateSampleData.json');
var details = process.env.INFLUX_HOST
    ? JSON.parse(process.env.INFLUX_HOST)
    : { host: '127.0.0.1', port: 8086 };
exports.db = process.env.INFLUX_TEST_DB || 'influx_test_db';
function newClient() {
    var client = new src_1.InfluxDB({
        database: exports.db,
        hosts: [details],
        schema: [
            {
                measurement: 'h2o_feet',
                tags: ['location'],
                fields: {
                    'level description': src_1.FieldType.STRING,
                    water_level: src_1.FieldType.FLOAT,
                },
            },
            {
                measurement: 'h2o_quality',
                tags: ['location', 'randtag'],
                fields: { index: src_1.FieldType.INTEGER },
            },
        ],
    });
    return client.dropDatabase(exports.db)
        .then(function () { return client.createDatabase(exports.db); })
        .then(function () { return client; });
}
exports.newClient = newClient;
function writeSampleData(client) {
    return client.writePoints(sampleData, { precision: 's' });
}
exports.writeSampleData = writeSampleData;
