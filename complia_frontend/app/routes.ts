import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("login", "routes/login.tsx"),
    route("ca-help", "routes/ca_help.tsx"),
    route("saved", "routes/saved_notices.tsx"),
    route("notice/:id", "routes/notice_details.tsx"),
] satisfies RouteConfig;
