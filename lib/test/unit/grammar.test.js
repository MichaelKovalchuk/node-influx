"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var grammar = require("../../src/grammar");
var escapeTables = require('../fixture/escapeTables.json');
describe('grammar', function () {
    Object.keys(escapeTables).forEach(function (escaper) {
        describe(escaper, function () {
            escapeTables[escaper].forEach(function (test) {
                it("escapes `" + test[0] + "` as `" + test[1] + "`", function () {
                    chai_1.expect(grammar.escape[escaper](test[0])).to.equal(test[1]);
                });
            });
        });
    });
    it('does not escape raw values', function () {
        chai_1.expect(grammar.escape.quoted(new grammar.Raw('don"t escape'))).to.equal('don"t escape');
    });
    it('escapes complex values (issue #242)', function () {
        var original = JSON.stringify({ a: JSON.stringify({ b: 'c c' }) });
        chai_1.expect(grammar.escape.quoted(original))
            .to.equal('"{\\"a\\":\\"{\\\\\\"b\\\\\\":\\\\\\"c c\\\\\\"}\\"}"');
    });
    var nanoDate;
    var milliDate;
    beforeEach(function () {
        nanoDate = grammar.isoOrTimeToDate('2016-10-09T03:58:00.231035677Z', 'n');
        milliDate = new Date(1475985480231);
    });
    it('converts a nanoseconds timestamp to a nano date', function () {
        var date = grammar.toNanoDate('1475985480231035600');
        chai_1.expect(date.getTime()).to.equal(1475985480231);
        chai_1.expect(date.getNanoTime()).to.equal('1475985480231035600'); // precision is lost
        chai_1.expect(date.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
    });
    describe('formatting', function () {
        it('formats nanosecond dates', function () {
            chai_1.expect(grammar.formatDate(nanoDate)).to.equal('"2016-10-09 03:58:00.231035677"');
        });
        it('formats millisecond dates', function () {
            chai_1.expect(grammar.formatDate(milliDate)).to.equal('"2016-10-09 03:58:00.231"');
        });
    });
    describe('parsing', function () {
        it('parses ISO dates correctly', function () {
            var parsed = grammar.isoOrTimeToDate('2016-10-09T03:58:00.231035677Z', 'n');
            chai_1.expect(parsed.getTime()).to.equal(1475985480231);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480231035677');
            chai_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035677Z');
        });
        it('parses numeric `ns` timestamps', function () {
            var parsed = grammar.isoOrTimeToDate(1475985480231035677, 'n');
            chai_1.expect(parsed.getTime()).to.equal(1475985480231);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480231035600'); // precision is lost
            chai_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035600Z');
        });
        it('parses numeric `u` timestamps', function () {
            var parsed = grammar.isoOrTimeToDate(1475985480231035, 'u');
            chai_1.expect(parsed.getTime()).to.equal(1475985480231);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480231035000');
            chai_1.expect(parsed.toNanoISOString()).to.equal('2016-10-09T03:58:00.231035000Z');
        });
        it('parses numeric `ms` timestamps', function () {
            var parsed = grammar.isoOrTimeToDate(1475985480231, 'ms');
            chai_1.expect(parsed.getTime()).to.equal(1475985480231);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480231000000');
        });
        it('parses numeric `s` timestamps', function () {
            var parsed = grammar.isoOrTimeToDate(1475985480, 's');
            chai_1.expect(parsed.getTime()).to.equal(1475985480000);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480000000000');
        });
        it('parses numeric `m` timestamps', function () {
            var parsed = grammar.isoOrTimeToDate(24599758, 'm');
            chai_1.expect(parsed.getTime()).to.equal(1475985480000);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475985480000000000');
        });
        it('parses numeric `h` timestamps', function () {
            var parsed = grammar.isoOrTimeToDate(409995, 'h');
            chai_1.expect(parsed.getTime()).to.equal(1475982000000);
            chai_1.expect(parsed.getNanoTime()).to.equal('1475982000000000000');
        });
    });
    describe('timestamp casting', function () {
        it('casts dates into timestamps', function () {
            var d = new Date(1475121809084);
            chai_1.expect(grammar.castTimestamp(d, 'n')).to.equal('1475121809084000000');
            chai_1.expect(grammar.castTimestamp(d, 'u')).to.equal('1475121809084000');
            chai_1.expect(grammar.castTimestamp(d, 'ms')).to.equal('1475121809084');
            chai_1.expect(grammar.castTimestamp(d, 's')).to.equal('1475121809');
            chai_1.expect(grammar.castTimestamp(d, 'm')).to.equal('24585363');
            chai_1.expect(grammar.castTimestamp(d, 'h')).to.equal('409756');
        });
        it('casts nanodates into timestamps', function () {
            var d = grammar.toNanoDate('1475985480231035600');
            chai_1.expect(grammar.castTimestamp(d, 'n')).to.equal('1475985480231035600');
            chai_1.expect(grammar.castTimestamp(d, 'u')).to.equal('1475985480231035');
            chai_1.expect(grammar.castTimestamp(d, 'ms')).to.equal('1475985480231');
            chai_1.expect(grammar.castTimestamp(d, 's')).to.equal('1475985480');
            chai_1.expect(grammar.castTimestamp(d, 'm')).to.equal('24599758');
            chai_1.expect(grammar.castTimestamp(d, 'h')).to.equal('409995');
        });
        it('accepts strings, numbers liternally', function () {
            chai_1.expect(grammar.castTimestamp('1475985480231035600', 's')).to.equal('1475985480231035600');
            chai_1.expect(grammar.castTimestamp(1475985480231, 's')).to.equal('1475985480231');
        });
        it('throws on non-numeric strings', function () {
            chai_1.expect(function () { return grammar.castTimestamp('wut', 's'); }).to.throw(/numeric value/);
        });
    });
});
