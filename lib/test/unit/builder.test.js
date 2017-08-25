"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var index_1 = require("../../src/index");
describe('query builder', function () {
    describe('measurement builder', function () {
        it('builds with only name', function () {
            chai_1.expect(new index_1.Measurement()
                .name('my_"meas')
                .toString()).to.equal('"my_\\"meas"');
        });
        it('builds with name and rp', function () {
            chai_1.expect(new index_1.Measurement()
                .name('my_"meas')
                .policy('po"licy')
                .toString()).to.equal('"po\\"licy"."my_\\"meas"');
        });
        it('builds with name, rp, and db', function () {
            chai_1.expect(new index_1.Measurement()
                .name('my_"meas')
                .policy('po"licy')
                .db('my_"db')
                .toString()).to.equal('"my_\\"db"."po\\"licy"."my_\\"meas"');
        });
        it('builds with name and db', function () {
            chai_1.expect(new index_1.Measurement()
                .name('my_"meas')
                .db('my_"db')
                .toString()).to.equal('"my_\\"db"."my_\\"meas"');
        });
        it('throws when a name is omitted', function () {
            chai_1.expect(function () { return new index_1.Measurement()
                .db('my_"db')
                .toString(); }).to.throw(/must specify a measurement/);
        });
    });
    describe('expression builder', function () {
        it('creates basic queries', function () {
            chai_1.expect(new index_1.Expression()
                .tag('my_"tag')
                .equals
                .value('42')
                .toString()).to.equal('"my_\\"tag" = \'42\'');
        });
        it('inserts data types correctly', function () {
            chai_1.expect(new index_1.Expression()
                .field('f')
                .equals
                .value('str\'')
                .or
                .field('f')
                .matches
                .value(/[0-9]+/)
                .or
                .field('f')
                .equals
                .value(42)
                .or
                .field('f')
                .equals
                .tag('my_"tag')
                .or
                .field('f')
                .equals
                .value(new Date(1475985480231))
                .or
                .field('f')
                .equals
                .value(index_1.toNanoDate('1475985480231035600'))
                .or
                .field('f')
                .equals
                .value(true)
                .or
                .exp(function (e) { return e.field('a').equals.value(1).or.field('b').equals.value(2); })
                .or
                .field('f')
                .doesntMatch
                .value({ toString: function () { return '/my-custom-re/'; } })
                .toString()).to.equal('"f" = \'str\\\'\' OR "f" =~ /[0-9]+/ OR "f" = 42 ' +
                'OR "f" = "my_\\"tag" OR "f" = "2016-10-09 03:58:00.231" ' +
                'OR "f" = "2016-10-09 03:58:00.231035600" OR "f" = TRUE ' +
                'OR ("a" = 1 OR "b" = 2) OR "f" !~ /my-custom-re/');
        });
        it('throws when using a flagged regex', function () {
            chai_1.expect(function () { return new index_1.Expression().field('f').matches.value(/a/i); })
                .to.throw(/doesn't support flags/);
        });
        it('throws when using un-stringifyable object', function () {
            chai_1.expect(function () { return new index_1.Expression().field('f').equals.value(Object.create(null)); })
                .to.throw(/doesn't know how to encode/);
        });
        var operationsTable = [
            { method: 'equals', yields: '=' },
            { method: 'notEqual', yields: '!=' },
            { method: 'gt', yields: '>' },
            { method: 'gte', yields: '>=' },
            { method: 'lt', yields: '<' },
            { method: 'lte', yields: '<=' },
            { method: 'plus', yields: '+' },
            { method: 'minus', yields: '-' },
            { method: 'times', yields: '*' },
            { method: 'div', yields: '/' },
            { method: 'and', yields: 'AND' },
            { method: 'or', yields: 'OR' },
            { method: 'matches', yields: '=~' },
            { method: 'doesntMatch', yields: '!~' },
        ];
        operationsTable.forEach(function (_a) {
            var method = _a.method, yields = _a.yields;
            it("yields " + yields + " from ." + method, function () {
                chai_1.expect(new index_1.Expression().field('f')[method].value(true).toString())
                    .to.equal("\"f\" " + yields + " TRUE");
            });
        });
    });
});
