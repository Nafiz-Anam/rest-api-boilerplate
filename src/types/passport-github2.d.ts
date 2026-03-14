declare module 'passport-github2' {
  import * as passport from 'passport';
  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
  }
  export class Strategy extends passport.Strategy {
    constructor(options: StrategyOptions, verify: (...args: any[]) => void);
  }
}
