"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var chai_1 = require("chai");
var exponential_1 = require("../../src/backoff/exponential");
describe('backoff strategies', function () {
    describe('exponential strategy', function () {
        it('appears to work', function () {
            var exp = new exponential_1.ExponentialBackoff({
                initial: 500,
                max: 5000,
                random: 1,
            });
            function next() {
                var value = exp.getDelay();
                exp = exp.next();
                return value;
            }
            var checkSequence = function () {
                chai_1.expect(next()).to.equal(500);
                chai_1.expect(next()).to.be.oneOf([500, 1000]);
                chai_1.expect(next()).to.be.oneOf([1000, 2000]);
                chai_1.expect(next()).to.be.oneOf([2000, 4000]);
                chai_1.expect(next()).to.be.oneOf([4000, 5000]);
                chai_1.expect(next()).to.equal(5000);
            };
            checkSequence();
            exp = exp.reset();
            var dupe = exp.reset();
            checkSequence();
            exp = dupe;
            checkSequence();
        });
    });
});
