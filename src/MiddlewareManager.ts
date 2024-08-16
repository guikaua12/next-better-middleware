import { NextRequest, NextResponse } from 'next/server';
import { AntPathMatcher } from './AntMatcher';

export type Context = {
    request: NextRequest;
    redirect: (href: string) => NextResponse;
    next: (callback: (res: NextResponse) => void) => NextResponse;
};

export type RouteCondition = (req: NextRequest) => NextResponse | Promise<NextResponse | null> | null;

export type Route = {
    path: string;
    conditions: RouteCondition[];
    subRoutes?: Route[];
};

export class MiddlewareManager {
    private readonly routes: Map<string, Route> = new Map();
    private readonly antMatcher: AntPathMatcher = new AntPathMatcher();

    constructor(routes: Route[]) {
        routes.forEach((route) => {
            this.routes.set(route.path, route);
        });
    }

    public async execute(req: NextRequest): Promise<NextResponse | null> {
        const route = this.getMatchingRoute(req.nextUrl.pathname);

        if (route) {
            for (const condition of route.conditions) {
                const result = await condition(req);

                if (result === null) continue;

                if (result instanceof NextResponse) {
                    return result;
                }

                if (result === false) {
                    return redirect(req, '/auth/login');
                }
            }
        }

        return NextResponse.next();
    }

    public getMatchingRoute(currentPath: string): Route | null {
        const findMatchingRoute = (currentPath: string, route: Route): Route | null => {
            if (route.subRoutes) {
                for (const subRoute of route.subRoutes) {
                    const matchingSubRoute = findMatchingRoute(currentPath, subRoute);
                    if (matchingSubRoute) {
                        return matchingSubRoute;
                    }
                }
            }
            if (this.antMatcher.match(route.path, currentPath)) {
                return route;
            }
            return null;
        };

        for (const route of this.routes.values()) {
            const matchingRoute = findMatchingRoute(currentPath, route);
            if (matchingRoute) {
                return matchingRoute;
            }
        }

        return null;
    }
}

export const redirect = (req: NextRequest, path: string) => {
    const url = req.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
};
