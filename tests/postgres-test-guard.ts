export type PostgresTestGuard={allowed:boolean;reason:string;target?:{host:string;port:string;database:string}};

function target(value:string,credentialFree=false){const url=new URL(value),protocol=url.protocol.toLowerCase();if(protocol!=="postgres:"&&protocol!=="postgresql:")throw new Error("URL must use PostgreSQL.");if(credentialFree&&(url.username||url.password))throw new Error("Identity must not contain credentials.");const host=url.hostname.toLowerCase(),database=decodeURIComponent(url.pathname.slice(1)).toLowerCase();if(!host||!database||database.includes("/"))throw new Error("Host and database are required.");return{host,port:url.port||"5432",database}}
export function evaluatePostgresTestGuard(testUrl:string|undefined,productionIdentity:string|undefined,optIn:string|undefined,disposableConfirmed:string|undefined,dispatchEnabled:string|undefined):PostgresTestGuard{
 if(!testUrl?.trim())return{allowed:false,reason:"WHATSAPP_TEST_DATABASE_URL is not configured."};
 if(optIn!=="1")return{allowed:false,reason:"WHATSAPP_TEST_ALLOW_SCHEMA_CREATE=1 is required."};
 if(disposableConfirmed!=="1")return{allowed:false,reason:"WHATSAPP_TEST_TARGET_CONFIRMED_DISPOSABLE=1 is required after service-owner authorization."};
 if(dispatchEnabled!=="0")return{allowed:false,reason:"WHATSAPP_DISPATCH_ENABLED must be explicitly set to 0 for PostgreSQL tests."};
 if(!productionIdentity?.trim())return{allowed:false,reason:"WHATSAPP_PRODUCTION_DATABASE_IDENTITY is required for a redacted target comparison."};
 let testTarget:ReturnType<typeof target>;try{testTarget=target(testUrl)}catch{return{allowed:false,reason:"The test database URL is not a valid PostgreSQL URL."}}
 if(!testTarget.database||!/(test|staging)/.test(testTarget.database))return{allowed:false,reason:"The database name must contain test or staging."};
 let productionTarget:ReturnType<typeof target>;try{productionTarget=target(productionIdentity,true)}catch{return{allowed:false,reason:"WHATSAPP_PRODUCTION_DATABASE_IDENTITY could not be safely parsed as a credential-free identity."}}
 if(productionTarget.host===testTarget.host&&productionTarget.port===testTarget.port&&productionTarget.database===testTarget.database)return{allowed:false,reason:"The test target has the same host, port, and database identity as production."};
 return{allowed:true,reason:"Explicit disposable-target and isolated-schema test opt-ins accepted.",target:testTarget};
}
