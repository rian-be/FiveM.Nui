fx_version 'cerulean'
game 'gta5'
lua54 'yes'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/dist/devtools.js',
    'html/dist/devtools.css',
    'logo.png',
    'html/logo.png',
    'src/Client/bin/Release/net10.0/publish/FiveM.Nui.DevTools.Client.dll',
    'src/Client/bin/Release/net10.0/publish/FiveM.Nui.dll',
    'src/Client/bin/Release/net10.0/publish/CitizenFX.FiveM.Client.dll',
    'src/Client/bin/Release/net10.0/publish/CitizenFX.FiveM.Shared.dll',
    'src/Client/bin/Release/net10.0/publish/MessagePack.dll',
    'src/Client/bin/Release/net10.0/publish/MessagePack.Annotations.dll',
    'src/Client/bin/Release/net10.0/publish/Microsoft.Extensions.DependencyInjection.dll',
    'src/Client/bin/Release/net10.0/publish/Microsoft.Extensions.DependencyInjection.Abstractions.dll',
}

client_script 'src/Client/bin/Release/net10.0/publish/FiveM.Nui.DevTools.Client.dll'

author 'FiveM.Nui'
description 'Standalone in-game transport diagnostics overlay for FiveM.Nui'
version '1.6.4'
