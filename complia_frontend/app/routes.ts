import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route("notice/:id", "routes/notice_details.tsx"),
] satisfies RouteConfig;

