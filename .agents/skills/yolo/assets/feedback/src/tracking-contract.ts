import type {Principal} from './contract.js';
export const TRACKING = 'yolo-tracking-v1';
export interface TrackingConfig {appId:string;authorizeWork:(p:Principal)=>boolean|Promise<boolean>}
export type Delivery = {state:'pending'} | {state:'available'|'unavailable';version:string;verifiedAt:number;evidence:string} | null;
export interface WorkData {audience:'app'|'hidden';title:string;summary:string;next:string;stage:string;delivery:Delivery;milestones:{at:number;text:string}[]}
export interface RequestData {decision:'received'|'needs-details'|'tracked'|'duplicate'|'answered'|'deferred'|'not-planned';interpretation:string;reason:string;next:string;coverage:{workId:string|null;scope:string;disposition:'tracked'|'declined'|'superseded'}[]}
export interface WorkPublication {id:string;base:string|null;workId:string;issue:number;view:WorkData}
export interface RequestPublication {id:string;base:string|null;requestId:string;view:RequestData}
