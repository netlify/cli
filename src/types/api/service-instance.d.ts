export interface ServiceInstance {
  id: string;
  url: string;
  config: Record<string, any>;
  external_attributes: Record<string, any>;
  service_slug: string;
  service_path: string;
  service_name: string;
  env: Record<string, any>;
  snippets: Record<string, any>[];
  auth_url: string;
  created_at: string;
  updated_at: string;
}