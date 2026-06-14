const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'app/(pages)/(dashboard)/grey-materials/page.tsx');
let content = fs.readFileSync(pagePath, 'utf8');

// Replace Table Headers
content = content.replace(
  /<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[50px\] sm:min-w-\[60px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Greigh\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[50px\] sm:min-w-\[60px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Finish\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[60px\] sm:min-w-\[70px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Weight\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[50px\] sm:min-w-\[60px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*GSM\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[60px\] sm:min-w-\[70px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Content\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[60px\] sm:min-w-\[70px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Denier\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[50px\] sm:min-w-\[60px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Reed\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[50px\] sm:min-w-\[60px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Pick\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[60px\] sm:min-w-\[70px\] md:min-w-\[80px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Price\n\s*<\/th>\n\s*<th className=\{`px-1 sm:px-1\.5 md:px-2 py-1\.5 sm:py-2 md:py-3 text-center text-\[9px\] xs:text-\[10px\] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-\[60px\] sm:min-w-\[80px\] md:min-w-\[100px\] \$\{\n\s*isDarkMode \? 'text-white border-slate-500 bg-slate-700\/50' : 'text-black border-gray-300 bg-white'\n\s*\}\`\}>\n\s*Rack\n\s*<\/th>/g,
  `<th className={\`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[80px] sm:min-w-[100px] \${
                      isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                    }\`}>
                      Challan No.
                    </th>
                    <th className={\`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[80px] \${
                      isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                    }\`}>
                      Piece
                    </th>
                    <th className={\`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 text-center text-[9px] xs:text-[10px] sm:text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 border-r whitespace-nowrap min-w-[60px] sm:min-w-[80px] \${
                      isDarkMode ? 'text-white border-slate-500 bg-slate-700/50' : 'text-black border-gray-300 bg-white'
                    }\`}>
                      Meter
                    </th>`
);

// Replace Table Data
content = content.replace(
  /\{\/\* Greigh Column \*\/\}[\s\S]*?\{\/\* Action Column - Download and Delete buttons for weaver \*\/\}/g,
  `{/* Challan No. Column */}
                          <td className={\`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center \${
                            isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                          }\`}>
                            <span className={\`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm \${isDarkMode ? 'text-teal-300' : 'text-teal-600'}\`}>
                              {greyMaterial.challanNumber || '-'}
                            </span>
                          </td>
                          
                          {/* Piece Column */}
                          <td className={\`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center \${
                            isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                          }\`}>
                            <span className={\`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm \${isDarkMode ? 'text-orange-300' : 'text-orange-600'}\`}>
                              {greyMaterial.piece > 0 ? greyMaterial.piece : '-'}
                            </span>
                          </td>
                          
                          {/* Meter Column */}
                          <td className={\`px-1 sm:px-1.5 md:px-2 py-1.5 sm:py-2 md:py-3 align-middle border-r text-center \${
                            isDarkMode ? 'text-gray-300 border-gray-600' : 'text-gray-900 border-gray-300'
                          }\`}>
                            <span className={\`font-bold text-[9px] xs:text-[10px] sm:text-xs md:text-sm \${isDarkMode ? 'text-pink-300' : 'text-pink-600'}\`}>
                              {greyMaterial.meter > 0 ? greyMaterial.meter : '-'}
                            </span>
                          </td>

                          {/* Action Column - Download and Delete buttons for weaver */}`
);

// Replace Card Items Details Grid
content = content.replace(
  /<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 text-sm sm:text-base">\s*<div className="space-y-1">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\)/g,
  `<div className="grid grid-cols-2 gap-2 sm:gap-3 text-sm sm:text-base">
                                      <div className="space-y-1">
                                        <div className={\`font-semibold \${isDarkMode ? 'text-gray-200' : 'text-gray-800'}\`}>
                                          Weaver Name:
                                        </div>
                                        <div className={\`font-bold break-words max-w-full \${isDarkMode ? 'text-blue-300' : 'text-blue-600'}\`}>
                                          {greyMaterial.weaver || '-'}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className={\`font-semibold \${isDarkMode ? 'text-gray-200' : 'text-gray-800'}\`}>
                                          Challan No:
                                        </div>
                                        <div className={\`font-bold \${isDarkMode ? 'text-teal-300' : 'text-teal-600'}\`}>
                                          {greyMaterial.challanNumber || '-'}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className={\`font-semibold \${isDarkMode ? 'text-gray-200' : 'text-gray-800'}\`}>
                                          Piece:
                                        </div>
                                        <div className={\`font-bold \${isDarkMode ? 'text-orange-300' : 'text-orange-600'}\`}>
                                          {greyMaterial.piece > 0 ? greyMaterial.piece : '-'}
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <div className={\`font-semibold \${isDarkMode ? 'text-gray-200' : 'text-gray-800'}\`}>
                                          Meter:
                                        </div>
                                        <div className={\`font-bold \${isDarkMode ? 'text-pink-300' : 'text-pink-600'}\`}>
                                          {greyMaterial.meter > 0 ? greyMaterial.meter : '-'}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))} `
);

// Write changes back
fs.writeFileSync(pagePath, content);
console.log('Successfully updated page.tsx');

// Now update CreateGreyMaterial.tsx and GreyMaterialFormContent.tsx
const createPath = path.join(__dirname, 'app/(pages)/(dashboard)/grey-materials/components/CreateGreyMaterial.tsx');
let createContent = fs.readFileSync(createPath, 'utf8');

// Replace form state initialization
createContent = createContent.replace(
  /weaver: '',\s*weaverQualityName: '',\s*rack: '',\s*greighWidth: '',\s*finishWidth: '',\s*weight: '',\s*gsm: '',\s*content: '',\s*danier: '',\s*count: '',\s*reed: '',\s*pick: '',\s*greighRate: ''/g,
  `weaver: '',\n          challanNumber: '',\n          piece: '',\n          meter: ''`
);

// Replace form validity
createContent = createContent.replace(
  /const requiredFirstWeaver = first\.weaver\?\.trim\(\) && first\.weaverQualityName\?\.trim\(\);\s*\/\/\s*All items must have weaver \+ weaverQualityName\s*const allItemsValid = formData\.items\.every\(it => it\.weaver\?\.trim\(\) && it\.weaverQualityName\?\.trim\(\)\);/g,
  `const requiredFirstWeaver = first.weaver?.trim();
    // All items must have weaver
    const allItemsValid = formData.items.every(it => it.weaver?.trim());`
);

// Replace form content checker
createContent = createContent.replace(
  /item\.weaver \|\|\s*item\.weaverQualityName \|\| item\.type \|\| item\.rack \|\|\s*item\.greighWidth \|\| item\.finishWidth \|\| item\.weight \|\|\s*item\.gsm \|\| item\.content \|\| item\.danier \|\| item\.count \|\|\s*item\.reed \|\| item\.pick \|\| item\.greighRate/g,
  `item.weaver || item.type || item.challanNumber || item.piece || item.meter`
);

// Replace mapping items
createContent = createContent.replace(
  /weaverQualityName: item\.weaverQualityName \|\| '',\s*rack: item\.rack \|\| '',\s*greighWidth: \(item\.greighWidth && item\.greighWidth > 0\) \? item\.greighWidth\.toString\(\) : '',\s*finishWidth: \(item\.finishWidth && item\.finishWidth > 0\) \? item\.finishWidth\.toString\(\) : '',\s*weight: \(item\.weight && item\.weight > 0\) \? item\.weight\.toString\(\) : '',\s*gsm: \(item\.gsm && item\.gsm > 0\) \? item\.gsm\.toString\(\) : '',\s*content: item\.content \|\| '',\s*danier: item\.danier \|\| '',\s*count: \(item\.count && item\.count > 0\) \? item\.count\.toString\(\) : '',\s*reed: \(item\.reed && item\.reed > 0\) \? item\.reed\.toString\(\) : '',\s*pick: \(item\.pick && item\.pick > 0\) \? item\.pick\.toString\(\) : '',\s*greighRate: \(item\.greighRate && item\.greighRate > 0\) \? item\.greighRate\.toString\(\) : ''/g,
  `challanNumber: item.challanNumber || '',\n          piece: (item.piece && item.piece > 0) ? item.piece.toString() : '',\n          meter: (item.meter && item.meter > 0) ? item.meter.toString() : ''`
);

// Update weaver grid inputs
createContent = createContent.replace(
  /\{/\*\s*Weaver Quality Name\s*\*/\}[\s\S]*?\{/\*\s*Rack\s*\*/\}[\s\S]*?\{/\*\s*Greigh Width\s*\*/\}[\s\S]*?\{/\*\s*Finish Width\s*\*/\}[\s\S]*?\{/\*\s*Weight\s*\*/\}[\s\S]*?\{/\*\s*GSM\s*\*/\}[\s\S]*?\{/\*\s*Content\s*\*/\}[\s\S]*?\{/\*\s*Danier\s*\*/\}[\s\S]*?\{/\*\s*Reed\s*\*/\}[\s\S]*?\{/\*\s*Pick\s*\*/\}[\s\S]*?\{/\*\s*Greigh Rate\s*\*/\}[\s\S]*?<\/div>\s*<\/div>/g,
  `{/* Challan Number */}
                      <div className="relative group/field">
                        <label className={\`block text-sm font-semibold mb-1.5 transition-colors \${isDarkMode ? 'text-gray-300 group-hover/field:text-blue-400' : 'text-gray-700 group-hover/field:text-blue-600'}\`}>
                          Challan Number
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.challanNumber}
                            onChange={(e) => handleItemChange(index, 'challanNumber', e.target.value)}
                            className={\`w-full p-2.5 rounded-lg border-2 transition-all duration-200 outline-none focus:ring-4 \${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-500' 
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-300'
                            }\`}
                            placeholder="Enter challan no"
                          />
                        </div>
                      </div>

                      {/* Piece */}
                      <div className="relative group/field">
                        <label className={\`block text-sm font-semibold mb-1.5 transition-colors \${isDarkMode ? 'text-gray-300 group-hover/field:text-blue-400' : 'text-gray-700 group-hover/field:text-blue-600'}\`}>
                          Piece (Number)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.piece}
                            onChange={(e) => handleItemChange(index, 'piece', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className={\`w-full p-2.5 rounded-lg border-2 transition-all duration-200 outline-none focus:ring-4 \${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-500' 
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-300'
                            }\`}
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Meter */}
                      <div className="relative group/field">
                        <label className={\`block text-sm font-semibold mb-1.5 transition-colors \${isDarkMode ? 'text-gray-300 group-hover/field:text-blue-400' : 'text-gray-700 group-hover/field:text-blue-600'}\`}>
                          Meter (Number)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.meter}
                            onChange={(e) => handleItemChange(index, 'meter', e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className={\`w-full p-2.5 rounded-lg border-2 transition-all duration-200 outline-none focus:ring-4 \${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-500' 
                                : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-300'
                            }\`}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>`
);

fs.writeFileSync(createPath, createContent);
console.log('Successfully updated CreateGreyMaterial.tsx');
