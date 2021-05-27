'use strict';

const _ = require('lodash');
const P = require('bluebird');
const Callstack = require('./callstack');
const wdBrowserCommands = require('webdriverio/build/commands/browser').default;
const wdElementCommands = require('webdriverio/build/commands/element').default;

const scopes = {
    BROWSER: 'b',
    ELEMENT: 'e'
};

const determineScope = (elementScope) => elementScope
  ? scopes.ELEMENT
  : scopes.BROWSER;

const runWithHooks = (fn, before, after) => P
    .resolve()
    .then(before)
    .then(fn)
    .finally(after);

const normalizeArgs = (name, args) => {
    if (name === 'execute') {
        return 'code...';
    }

    return args.map((arg) => {
        if (_.isString(arg)) {
            return _.truncate(arg, {length: 50});
        }

        if (_.isPlainObject(arg)) {
            return 'obj';
        }

        return arg;
    });
};

const overwriteAddCommand = (wdioBrowser, callstack) => {
    wdioBrowser.overwriteCommand('addCommand', (origAddCommand, name, wrapper, elementScope) => {
        const decoratedWrapper = async (...args) => runWithHooks(
            () => wrapper.apply(wdioBrowser, args),
            () => callstack.enter({n: name, a: normalizeArgs(name, args), s: determineScope(elementScope)}),
            () => callstack.leave()
        );

        origAddCommand(name, decoratedWrapper, elementScope);
    });
};

const overwriteCommands = ({wdioBrowser, callstack, commands, elementScope}) => {
    commands.forEach((name) => {
        wdioBrowser.overwriteCommand(name, async (origFn, ...args) => runWithHooks(
            () => origFn(...args),
            () => callstack.enter({n: name, a: normalizeArgs(name, args), s: determineScope(elementScope)}),
            () => callstack.leave()
        ), elementScope);
    });
};

const overwriteBrowserCommands = (wdioBrowser, callstack) => {
    overwriteCommands({
        wdioBrowser,
        callstack,
        commands: _.keys(wdBrowserCommands),
        elementScope: false
    });
};

const overwriteElementCommands = (wdioBrowser, callstack) => {
    overwriteCommands({
        wdioBrowser,
        callstack,
        commands: _.keys(wdElementCommands),
        elementScope: true
    });
};

exports.mkCallstackHistory = (wdioBrowser) => {
    const callstack = new Callstack();

    overwriteAddCommand(wdioBrowser, callstack);
    overwriteBrowserCommands(wdioBrowser, callstack);
    overwriteElementCommands(wdioBrowser, callstack);

    return callstack;
};

exports.mkDryCallstackHistory = () => {
    const callstack = new Callstack();

    return callstack;
};
