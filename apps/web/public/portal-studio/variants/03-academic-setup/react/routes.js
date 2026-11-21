/* Exact route-state boundaries in the supplied React app; this app uses activeScreen, not a URL router. */
export const DESIGN_NAMES=["Ledger","Field index","Working desk","Cards","Grouped fields","Readiness queue","Input review","Overview first","One at a time","Attribute matrix"];
const admin=["administrator"],coordinator=["coordinator"],all=["administrator","coordinator","advisor","normalStudent","advisingStudent"];
export const ACADEMIC_ROUTES={
 courses:{label:"Course catalogue",read:all,write:admin,api:["GET /api/catalogue/courses"],requirements:[18,19,128]},
 "course-detail":{label:"Course details",read:all,write:admin,api:["GET /api/catalogue/courses"],requirements:[19,20]},
 "course-editor":{label:"Create / edit course",read:admin,write:admin,api:["POST /api/catalogue/courses","PUT /api/catalogue/courses/:id"],requirements:[18,20]},
 "course-import":{label:"Import course CSV",read:admin,write:admin,api:["POST /api/catalogue/courses/import"],requirements:[128]},
 "course-delete":{label:"Delete unused course",read:admin,write:admin,api:["DELETE /api/catalogue/courses/:id"],requirements:[21]},
 terms:{label:"Academic terms",read:all,write:admin,api:["GET /api/academic-terms/academicTerm"],requirements:[16,17]},
 "term-editor":{label:"Create / edit academic term",read:all,write:admin,api:["POST /api/academic-terms/academicTerm","PUT /api/academic-terms/academicTerm/:id"],requirements:[16,17]},
 offerings:{label:"Course offerings",read:admin,write:admin,api:["GET /api/catalogue/offerings?termId=:id"],requirements:[22,23,25,26,27]},
 "offering-editor":{label:"Create offering",read:admin,write:admin,api:["POST /api/catalogue/offerings"],requirements:[22,23,25,26]},
 "offering-detail":{label:"Manage offering",read:admin,write:admin,api:["GET /api/catalogue/offerings/:id","PUT /api/catalogue/offerings/:id"],requirements:[23,25,26]},
 "slot-editor":{label:"Edit teaching groups",read:admin,write:admin,api:["PUT /api/catalogue/offerings/:id/slots/:slotId","POST /api/catalogue/offerings/:id/slots"],requirements:[23,26]},
 "slot-delete":{label:"Remove teaching group",read:admin,write:admin,api:["DELETE /api/catalogue/offerings/:id/slots/:slotId"],requirements:[23,26]},
 "offering-publication":{label:"Review offering publication",read:admin,write:admin,api:["PATCH /api/catalogue/offerings/:id/publish"],requirements:[27]},
 "offering-delete":{label:"Delete unused offering",read:admin,write:admin,api:["DELETE /api/catalogue/offerings/:id"],requirements:[26]},
 "copy-offerings":{label:"Copy offerings",read:admin,write:admin,api:["GET /api/academic-terms/academicTerm","GET /api/catalogue/offerings?termId=:source","POST /api/catalogue/offerings/duplicate"],requirements:[24]},
 templates:{label:"Schedule templates",read:coordinator,write:coordinator,api:["GET /api/academics/schedule-templates?termId=:id"],requirements:[28,29]},
 "template-detail":{label:"Create / edit schedule template",read:coordinator,write:coordinator,api:["GET /api/catalogue/offerings?termId=:id&publishedOnly=true","POST /api/academics/schedule-templates","PUT /api/academics/schedule-templates/:id"],requirements:[28,29]},
 "template-delete":{label:"Delete schedule template",read:coordinator,write:coordinator,api:["DELETE /api/academics/schedule-templates/:id"],requirements:[29]},
 "group-assignments":{label:"Group assignments",read:["administrator","coordinator"],write:coordinator,api:["GET /api/group-assignments/terms","GET /api/group-assignments/students","GET /api/group-assignments/groups"],requirements:[30]},
 "assignment-review":{label:"Assign / reassign normal student",read:coordinator,write:coordinator,api:["POST /api/group-assignments"],requirements:[30]},
 "assignment-remove":{label:"Unassign normal student",read:coordinator,write:coordinator,api:["DELETE /api/group-assignments/:studentId?termId=:id"],requirements:[30]}
};
