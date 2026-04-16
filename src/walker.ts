
import { JSONPathWalker as JSON } from './json.js'
import { Subscription } from '@console-one/subscription'

export class Handler {
  constructor(
    public success: (item: any) => void,
    public error: (item: Error) => void,
    public complete?: () => void) {
  }
}

export class PipedHandler<ItemKeyType, ItemType, VersionType> {
  constructor(
    public success: (key: ItemKeyType, version: VersionType, item: ItemType) => void,
    public error: (key: ItemKeyType, item: Error) => void,
    public complete: (version: VersionType) => void,
    public unsubscribe: () => void) {
  }

  cancel() {
    this.unsubscribe();
  }
}


export interface Walker {
  type: string
  addHandler(path: string, handler: Handler | Subscription<any>): Walker 
  walk(item: any, unfound?: Set<string>, currentpath?: string) : void
}

export interface WalkerFactory {

  create(type: string) : Walker

}

export const WalkerFactory =  {

  create(type: string) {

    if (type === 'json') return new JSON();
    else throw new Error(`No known walker for type: ${type}`);
    
  }
}


export { JSONPathWalker as JSON } from './json.js';
