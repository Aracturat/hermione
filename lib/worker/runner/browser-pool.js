'use strict';

const {Calibrator} = require('gemini-core');
const _ = require('lodash');
const Browser = require('../../browser/existing-browser');
const RunnerEvents = require('../constants/runner-events');
const ipc = require('../../utils/ipc');
const debug = require('debug')(`hermione:worker:browser-pool`);

module.exports = class BrowserPool {
    static create(config, emitter) {
        return new BrowserPool(config, emitter);
    }

    constructor(config, emitter) {
        this._config = config;
        this._emitter = emitter;
        this._browsers = {};
        this._calibrator = new Calibrator();
    }

    async getBrowser(browserId, browserVersion, sessionId) {
        debug(`get browser with id: ${browserId}, version: ${browserVersion} and session: ${sessionId}`);

        this._browsers[browserId] = this._browsers[browserId] || [];

        let browser = _.find(this._browsers[browserId], (browser) => {
            return browserVersion
                ? _.isNil(browser.sessionId) && browser.version === browserVersion
                : _.isNil(browser.sessionId);
        });

        try {
            if (browser) {
                debug(`reinit browser with sessionId: ${sessionId}`);
                return await browser.reinit(sessionId);
            }

            browser = Browser.create(this._config, browserId, browserVersion, this._emitter);

            this._browsers[browserId].push(browser);

            await browser.init(sessionId, this._calibrator);
            this._emitter.emit(RunnerEvents.NEW_BROWSER, browser.publicAPI, {browserId: browser.id, browserVersion});

            return browser;
        } catch (error) {
            if (!browser) {
                throw error;
            }

            browser.sessionId = sessionId;
            browser.markAsBroken();
            this.freeBrowser(browser);

            throw Object.assign(error, {meta: browser.meta});
        }
    }

    freeBrowser(browser) {
        debug(`send to master event: worker.${browser.sessionId}.freeBrowser with state ${JSON.stringify(browser.state)}`);
        ipc.emit(`worker.${browser.sessionId}.freeBrowser`, browser.state);

        if (browser.state.isBroken) {
            debug(`remove broken browser session from browsers map: ${browser.sessionId}`);
            _.pull(this._browsers[browser.id], browser);
        }

        debug(`close browser with sessionId: ${browser.sessionId}`);
        browser.quit();
    }
};
