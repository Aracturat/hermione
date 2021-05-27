'use strict';

const _ = require('lodash');

module.exports = class Callstack {
    constructor() {
        this._history = [];
        this._stack = [];
    }

    enter(data) {
        this._stack.push({...data, ts: Date.now(), c: []});
    }

    leave() {
        const currentNode = this._stack.pop();
        const parentNode = _.last(this._stack);
        const isCurrentNodeRoot = this._stack.length === 0;

        currentNode.te = Date.now();
        currentNode.d = currentNode.te - currentNode.ts;

        isCurrentNodeRoot
            ? this._history.push(currentNode)
            : parentNode.c.push(currentNode);
    }

    flush() {
        const history = this._history;

        this._stack = [];
        this._history = [];

        return history;
    }
};
