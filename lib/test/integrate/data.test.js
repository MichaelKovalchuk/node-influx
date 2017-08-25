"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var helpers_1 = require("./helpers");
describe('data operations', function () {
    var db;
    beforeEach(function () {
        return helpers_1.newClient()
            .then(function (client) { return db = client; })
            .then(function () { return helpers_1.writeSampleData(db); });
    });
    it('shows databases', function () {
        return db.getDatabaseNames().then(function (res) { return chai_1.expect(res).contain('influx_test_db'); });
    });
    it('writes complex values (issue #242)', function () {
        var original = JSON.stringify({ a: JSON.stringify({ b: 'c c' }) });
        return db.writeMeasurement('complex_value_series', [
            { fields: { msg: original } },
        ]);
    });
    it('lists measurements', function () {
        return db.getMeasurements().then(function (res) {
            chai_1.expect(res).to.deep.equal(['h2o_feet', 'h2o_quality']);
        });
    });
    it('lists series', function () {
        return db.getSeries().then(function (res) {
            chai_1.expect(res).to.deep.equal([
                'h2o_feet,location=coyote_creek',
                'h2o_feet,location=santa_monica',
                'h2o_quality,location=coyote_creek,randtag=1',
                'h2o_quality,location=coyote_creek,randtag=2',
                'h2o_quality,location=coyote_creek,randtag=3',
            ]);
        });
    });
    it('drops series', function () {
        return db.dropSeries({
            where: function (e) { return e.tag('randtag').equals.value('1'); },
            measurement: 'h2o_quality',
        }).then(function () { return db.getSeries(); })
            .then(function (res) { return chai_1.expect(res).to.not.contain('h2o_quality,location=coyote_creek,randtag=1'); });
    });
    it('gets measurements', function () {
        return db.getMeasurements()
            .then(function (res) { return chai_1.expect(res).to.deep.equal(['h2o_feet', 'h2o_quality']); });
    });
    it('drops measurement', function () {
        return db.dropMeasurement('h2o_feet')
            .then(function () { return db.getMeasurements(); })
            .then(function (res) { return chai_1.expect(res).to.not.contain('h2o_feet'); });
    });
});
