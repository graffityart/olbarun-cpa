/** Only explicit boolean consent is accepted for CPA personal-data submission. */
export function hasExplicitCpaConsent(value:unknown):boolean{
 if(!value||typeof value!=="object"||Array.isArray(value))return false;
 const body=value as Record<string,unknown>;
 return body.privacy===true&&body.thirdParty===true;
}
