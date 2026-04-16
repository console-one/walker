

import { ListMultimap } from '@console-one/multimap';

import { Subscription } from '@console-one/subscription'
import { Handler, Walker } from './walker.js'





const ROOT = '@';

export class JSONPathWalker implements Walker {

  type: string
  pathMap: Map<string, Set<string>>;
  handlerMap: ListMultimap<string, Handler | Subscription<any>>;

  constructor(public errorOnUnfound: boolean = true) {
    this.pathMap = new Map<string, Set<string>>();
    this.pathMap.set(ROOT, new Set<string>());
    this.handlerMap = new ListMultimap<string, Handler | Subscription<any>>();
    this.type = 'json';
  }

  public loadAll(paths: string[], item: any) {

    let outputs = new Array(paths.length).map(isNull => undefined);

    for (let index = 0; index < paths.length; index++) {
      this.addHandler(paths[index], {
        success: (item) => {
          outputs[index] = item;
        },
        error: (err) => {
          throw err;
        },
        complete: () => {}
      })
    }

    this.walk(item);

    return outputs;
  }

  public addHandler(path: string, handler: Handler | Subscription<any>): JSONPathWalker {

    if (path.charAt(0) === ROOT) {
      let node: string = ROOT;
      let subpaths: string[] = path.split('.').slice(1);

      for (let subpath of subpaths) {
        if (!this.pathMap.has(node)) this.pathMap.set(node, new Set<string>());
        let branches: Set<string> = this.pathMap.get(node);
        branches = this.resolveSubpaths(branches, subpath);
        this.pathMap.set(node, branches);
        node = node + '.' + subpath;
      }

      this.handlerMap.set(node, handler);
    }
    return this;
  }

  public walk(
    item: any,
    unfound: Set<string> = new Set<string>([...this.handlerMap.keys()]),
    currentpath: string = '@'
  ): void {

    if (this.handlerMap.has(currentpath)) {
      for (let handler of this.handlerMap.get(currentpath)) {
        if (handler instanceof Subscription) {
          handler.resolve(item);
        } else {
          handler.success(item);
        }
      }
      unfound.delete(currentpath);
    }

    if (this.pathMap.has(currentpath)) {

      for (let subpath of this.pathMap.get(currentpath)) {

        let isObjectType = typeof item === 'object' && item !== null && !Array.isArray(item);
        let isArrayType = typeof item === 'object' && item !== null && Array.isArray(item);
        
        if (isObjectType && item.hasOwnProperty(subpath)) this.walk(item[subpath], unfound, currentpath + '.' + subpath);
        else if (isArrayType && Number(subpath) >= 0 && Number(subpath) < item.length) this.walk(item[subpath], unfound, currentpath + '.' + subpath);
      }

    }

    if (currentpath === '@') {
      for (let path of unfound) {
        for (let handler of this.handlerMap.get(path)) {
          if (this.errorOnUnfound) {
            if (handler instanceof Subscription) {
              handler.reject(new Error(`Input item of: ${JSON.stringify(item, null, 4)} does not have required property: ${path}`))
            } else {
              handler.error(new Error(`Input item of: ${JSON.stringify(item, null, 4)} does not have required property: ${path}`));
            }
          } else if (handler instanceof Subscription) {
            handler.resolve(null);
          } else if (typeof (handler as Handler).complete === 'function') {
            (handler as Handler).complete!();
          }
        }
      }
    }
  }

  public explore(
    obj: any, 
    path: string = '', 
    data: [string, number, any][] = []): [boolean, [string, number, any][]] {

    if (obj !== Object(obj)) {
      data.push([path, hashCode(path), obj]);
      return [true, data];
    }
    if (Object.keys(obj).length < 1) {
      data.push([path, hashCode(path), obj]);
      return [true, data];
    }
    let thisOutcome: boolean = false;
    for (let key of Object.keys(obj)) {
      let outcome = this.explore(obj[key], path + '.' + key, data);
      thisOutcome = thisOutcome || outcome[0];
    }
    return [thisOutcome, data];
  }

  private resolveSubpaths(currentSubpaths: Set<string>, newSubpath: string): Set<string> {
    if (currentSubpaths.has('*') || newSubpath === '*') new Set(['*']);
    currentSubpaths.add(newSubpath);
    return currentSubpaths;
  }
}

function hashCode(s: string) {
  for (var i = 0, h = 0; i < s.length; i++)
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return h;
}
