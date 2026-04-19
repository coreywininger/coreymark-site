output "resource_group_name" {
  description = "Resource group containing the site resources."
  value       = azurerm_resource_group.main.name
}

output "static_web_app_name" {
  description = "Name of the Azure Static Web App resource."
  value       = azurerm_static_web_app.main.name
}

output "default_hostname" {
  description = "ASWA default `*.azurestaticapps.net` hostname. Site is reachable here before the custom domain cutover."
  value       = azurerm_static_web_app.main.default_host_name
}

output "api_key" {
  description = "Deployment token. Add to GitHub repo as `AZURE_STATIC_WEB_APPS_API_TOKEN` secret. Retrieve with: terraform output -raw api_key"
  value       = azurerm_static_web_app.main.api_key
  sensitive   = true
}

output "apex_validation_token" {
  description = "TXT value for the apex (@) record on coreymark.com. NOT asuid.<apex> — ASWA validates at the apex itself, unlike Azure App Service. Populated after the apex custom-domain resource is created. Retrieve with: terraform output -raw apex_validation_token"
  value       = azurerm_static_web_app_custom_domain.apex.validation_token
  sensitive   = true
}
