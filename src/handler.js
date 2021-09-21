/**
 * Copyright 2021 Thetis Apps Aps
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * 
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * 
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const axios = require('axios');

// Look into using shopify node library

// Set cookie to allow front end pages to access correct entry in Shop-Seller map

var AWS = require('aws-sdk');
AWS.config.update({region:'eu-west-1'});


async function getIMS(apiKey) {

    const authUrl = "https://auth.thetis-ims.com/oauth2/";
    const apiUrl = "https://api.thetis-ims.com/2/";

	let clientId = process.env.ClientId;
	let clientSecret = process.env.ClientSecret;  

    let credentials = clientId + ":" + clientSecret;
	let base64data = Buffer.from(credentials, 'UTF-8').toString('base64');	
	
	let imsAuth = axios.create({
			baseURL: authUrl,
			headers: { Authorization: "Basic " + base64data, 'Content-Type': "application/x-www-form-urlencoded" },
			responseType: 'json'
		});

    let response = await imsAuth.post("token", 'grant_type=client_credentials');
    let token = response.data.token_type + " " + response.data.access_token;
    
    let ims = axios.create({
    		baseURL: apiUrl,
    		headers: { "Authorization": token, "x-api-key": apiKey, "Content-Type": "application/json" }
    	});
	
	ims.interceptors.response.use(function (response) {
			console.log("SUCCESS " + JSON.stringify(response.data));
 	    	return response;
		}, function (error) {
			if (error.response) {
				console.log("FAILURE " + error.response.status + " - " + JSON.stringify(error.response.data));
			}
	    	return Promise.reject(error);
		});
		
    return ims;
}

async function getShopifyToken(shop, shopifyApiKey, shopifyApiSecretKey, code) {
    let response = await axios.post('https://' + shop + '/admin/oauth/access_token',
    		{ shop: shop, code: code, client_id: shopifyApiKey, client_secret: shopifyApiSecretKey }
    	);
    return response.data;
}

async function getShopify(shop, token) {
    
    let shopify = axios.create({
    		baseURL: 'https://' + shop + '/admin/api/2021-04/',
    		headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token }
    	});
    
	shopify.interceptors.response.use(function (response) {
			console.log("SUCCESS " + JSON.stringify(response.data));
 	    	return response;
		}, function (error) {
			if (error.response) {
				console.log("FAILURE " + error.response.status + " - " + JSON.stringify(error.response.data));
			}
	    	return Promise.reject(error);
		});
		
    return shopify;
}

async function getSetup(ims) {
    let sellerNumber = process.env.SellerNumber;
    let filter = new Object();
    filter.sellerNumberMatch = sellerNumber;
    let response = await ims.get('sellers', { params: filter });
    let sellers = response.data;
    if (sellers.length == 0) {
        throw "No seller with this number in Thetis IMS: " + sellerNumber;
    }
    let dataDocument = JSON.parse(sellers[0].dataDocument);
    return dataDocument.DemoShopifyIntegration;
}

exports.pushOrder = async (event, x) => {
    
    let ims = await getIMS("look me up in the table!");
    
    let shopify = await getShopify(setup.host, process.env.ShopifyApiKey, process.env.ShopifyApiSecretKey);
    
}

exports.startInstall = async (event, x) => {

    try {
        
        console.log(JSON.stringify(event));
        
        let shopifyApiKey = process.env.ShopifyApiKey;
        let redirectUri = 'https://' + event.requestContext.domainName + '/Prod/install';
        
        let shop = event.queryStringParameters.shop;
        let timestamp = event.queryStringParameters.timestamp;
        let hmac = event.queryStringParameters.hmac;
        
        // Check HMAC
        
        // Create in map and store nonce
        
        let nonce = timestamp;
        
        let response = {
            'statusCode': 302,
            'headers': {
                'location': 'https://' + shop + '/admin/oauth/authorize?client_id=' + shopifyApiKey + '&scope=read_orders&redirect_uri=' + redirectUri + '&state=' + timestamp + '&grant_options[]=offline'
            }
        }

        console.log(JSON.stringify(response));

        return response;
        
    } catch (err) {
        console.log(err);
        return err;
    }
    

}

exports.install = async (event, x) => {

    console.log(JSON.stringify(event));
    
    let shopifyApiKey = process.env.ShopifyApiKey;
    let shopifyApiSecretKey = process.env.ShopifyApiSecretKey;
    let redirectUri = 'https://' + event.requestContext.domainName + '/Prod/install';
    
    let code = event.queryStringParameters.code;
    let shop = event.queryStringParameters.shop;
    let nonce = event.queryStringParameters.state;
    let timestamp = event.queryStringParameters.timestamp;
    let hmac = event.queryStringParameters.hmac;
    
    // Check HMAC

    // Lookup in map and check nonce
    
    // Get permanent token and store in map
    
    // Create webhooks
    
    let access = await getShopifyToken(shop, shopifyApiKey, shopifyApiSecretKey, code);
    let token = access.token;

    console.log(JSON.stringify(access));

    let response = {
        'statusCode': 200,
        'body': 'Installed!!'
    }

    return response;

}
    
exports.pushItems = async (event, x) => {
    
    let ims = await getIMS();
    
    let setup = await getSetup(ims);
    
    let shopify = await getShopify(setup.host, setup.apiKey, setup.password);
    
    let response = await ims.get('products');
    let products = response.data;
    
    for (let i = 0; i < products.length; i++) {
        let product = products[i];
        
        let response = await shopify.get('products.json', { params: { handle: product.productNumber }});
        let ps = response.data.products;

        if (ps.length == 0) {
            
            let images = [];
            let variants = [];
            
            let p = new Object();
            p.handle = product.productNumber;
            p.title = product.productName;

            let filter = { productNumberMatch: product.productNumber };
            response = await ims.get('globalTradeItems', { params: filter });
            let items = response.data;
            for (let j = 0; j < items.length; j++) {
                let item = items[j];
    
                let variant = new Object();
                variant.sku = item.stockKeepingUnit;
                let key = item.productVariantKey;
                if (key.description != null) { 
                    variant.option1 = key.description;
                } else {
                    variant.option1 = item.stockKeepingUnit
                }
                if (key.color != null) { variant.option2 = key.color };
                if (key.size != null) { variant.option3 = key.size };
                if (key.material != null) { variant.option4 = key.material };
                if (key.packagingType != null) { variant.option5 = key.packagingType };
                
                response = await ims.get('globalTradeItems/' + item.id + '/attachments');
                let attachments = response.data;
                
                for (let k = 0; k < attachments.length; k++) {
                    let attachment = attachments[k];
                    let image = new Object();
                    image.fileName = attachment.fileName;
                    image.src = attachment.presignedUrl;
                    response = await shopify.post('products/' + p.id + '/images.json', { image });
                    image = response.data.image;
                    images.push(image);
                }
                
                variants.push(variant);

            }
            
            p.variants = variants;
            p.images = images;
            
            response = await shopify.post('products.json', { product: p });
            p = response.data.product;
                
        }
    }
}