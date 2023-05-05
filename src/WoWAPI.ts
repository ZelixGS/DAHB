import {promisify} from 'node:util';
import stream from 'node:stream';
import fs from 'node:fs';
import got from 'got';
import config from '../config.json' assert { type: 'json' };


let AccessToken = "K";

const WoWAPI = got.extend({
    headers: {
        Authorization: `Bearer ${AccessToken}`,
    },
    method: 'GET',
    retry: {
        limit: 2,
    },
    hooks: {
        afterResponse: [
            async (response, retryWithMergedOptions) => {
                if (response.statusCode === 401) {
                    let newauth = await RefreshAccessToken()
                    const updatedOptions = {
                        headers:  { Authorization: `Bearer ${newauth}` }
                    }

                    // Update the defaults
                    WoWAPI.defaults.options.merge(updatedOptions);

                    // Make a new retry
                    return retryWithMergedOptions(updatedOptions);
                }

                // No changes otherwise
                return response;
            }
        ],
        beforeRetry: [
            (error, retryCount) => {
                console.log(`Retrying [${retryCount}]: ${error.code}`);
            }
        ]
    },
    mutableDefaults: true
});

export async function DownloadAH(): Promise<void> {
    console.warn("Downloading AH Data...")
    let json = await Get('https://us.api.blizzard.com/data/wow/auctions/commodities?namespace=dynamic-us&locale=en_US');
    console.warn("Writing AH Data to Disk...")
    fs.writeFileSync('./data/commodities.json', JSON.stringify(json));
    console.warn("Finished")
    return json
}

export const Get = async (url: string) => {
    try {
        let response = await WoWAPI(url);
        return JSON.parse(response.body);
    } catch (error) { console.error(error); }
    return null
}

async function RefreshAccessToken() {
    const BNET_ID = config.BNET_ID;
    const BNET_SECRET = config.BNET_SECRET;
    let url = 'https://us.battle.net/oauth/token'
    const options = {
        searchParams: { grant_type: 'client_credentials' },
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + Buffer.from(`${BNET_ID}:${BNET_SECRET}`).toString('base64')
        }
    };
    let Token = await got.post(url, options)
    AccessToken = JSON.parse(Token.body).access_token
    return AccessToken
}