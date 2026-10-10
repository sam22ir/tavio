// Built-in clause templates for a vente a temperament (installment sale). Used until a company saves its own.
// Placeholders are {variable} tokens listed in CLAUSE_VARIABLES (service/clauses.ts).
// French is the legal reference text. English prints use the French template.

export const DEFAULT_CLAUSES_FR = `Modèle à faire valider par un juriste

Article 1 - Objet
Le présent contrat a pour objet la vente à tempérament, par {societe_nom} (NIF {societe_nif}) à {client_nom} (NIN {client_nin}, adresse {client_adresse}), des biens désignés dans le présent contrat, conclu le {date_contrat} à {ville}.

Article 2 - Prix et apport
Le prix au comptant est de {montant_comptant}. La majoration appliquée au crédit est de {majoration}. L'acheteur verse à la signature un apport de {apport}. Le montant financé est de {montant_finance}.

Article 3 - Échéancier
Le montant financé est remboursé en {nombre_echeances} échéances de {montant_echeance} chacune, à fréquence {frequence}. La première échéance est due le {date_premiere_echeance}. L'échéancier détaillé figure dans le présent contrat.

Article 4 - Réserve de propriété
Le vendeur conserve la propriété des biens jusqu'au paiement intégral du prix et de ses accessoires. Tant que le prix n'est pas intégralement payé, l'acheteur ne peut ni vendre, ni donner en gage, ni céder les biens. En cas de défaut de paiement, le vendeur peut reprendre possession des biens.

Article 5 - Retard de paiement et pénalités
Toute échéance non réglée à son terme porte intérêt de retard au taux de {penalite_retard} % par mois à compter de la date d'échéance, sans mise en demeure préalable. Le vendeur peut résilier le contrat si une mise en demeure reste sans effet pendant quinze (15) jours.

Article 6 - Remboursement anticipé
L'acheteur peut à tout moment rembourser par anticipation tout ou partie du solde. Le remboursement total donne lieu à la délivrance d'une quittance et à la levée de la réserve de propriété. La majoration afférente aux échéances non échues est réduite à due proportion.

Article 7 - Caution solidaire
Le garant {garant_nom} se porte caution solidaire de l'acheteur pour le paiement de toutes les sommes dues au titre du présent contrat, en principal, intérêts et pénalités. Il renonce au bénéfice de discussion et est tenu comme débiteur principal.

Article 8 - Livraison et garantie
Les biens sont livrés à l'adresse de l'acheteur ou remis au point de vente à la date convenue. La garantie légale et, le cas échéant, la garantie commerciale du fabricant s'appliquent dans les conditions prévues par la loi et le bon de livraison signé.

Article 9 - Données personnelles
Les données personnelles collectées sont traitées par le vendeur aux seules fins de la gestion du présent contrat, conformément à la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel. L'acheteur dispose d'un droit d'accès, de rectification et d'opposition dans les conditions de la loi.

Article 10 - Juridiction
Tout litige relatif au présent contrat relève des tribunaux compétents de {ville}.

Fait à {ville}, le {date_contrat}, en deux exemplaires.`;

export const DEFAULT_CLAUSES_AR = `نموذج يجب أن يصادق عليه محامٍ

المادة 1 - الموضوع
يهدف هذا العقد إلى البيع بالتقسيط من طرف {societe_nom} (رقم التعريف الجبائي {societe_nif}) إلى {client_nom} (رقم التعريف الوطني {client_nin}، العنوان {client_adresse})، للسلع المحددة في هذا العقد، المبرم بتاريخ {date_contrat} بـ {ville}.

المادة 2 - الثمن والدفعة الأولى
الثمن نقدا: {montant_comptant}. الزيادة المطبقة على البيع المؤجل: {majoration}. يدفع المشتري عند التوقيع دفعة أولى قدرها {apport}. المبلغ الممول: {montant_finance}.

المادة 3 - جدول الأقساط
يسدد المبلغ الممول على {nombre_echeances} قسطا، قيمة كل قسط {montant_echeance}، بدورية {frequence}. يستحق القسط الأول بتاريخ {date_premiere_echeance}. ويرد جدول الأقساط المفصل ضمن هذا العقد.

المادة 4 - شرط الاحتفاظ بالملكية
يحتفظ البائع بملكية السلع إلى حين الوفاء الكامل بالثمن وملحقاته. ولا يحق للمشتري بيع السلع أو رهنها أو التصرف فيها قبل ذلك. وعند الإخلال بالسداد يحق للبائع استرداد السلع.

المادة 5 - التأخير في الدفع والغرامات
يترتب على كل قسط لم يسدد في أجله فائدة تأخير بنسبة {penalite_retard} % شهريا من تاريخ الاستحقاق، دون حاجة إلى إعذار. ويحق للبائع فسخ العقد إذا بقي الإنذار دون جدوى لمدة خمسة عشر (15) يوما.

المادة 6 - السداد المبكر
يحق للمشتري أن يسدد كل الرصيد أو جزءا منه قبل أجله. ويسلم البائع عند السداد الكامل وصلا، ويرفع شرط الاحتفاظ بالملكية. وتخفض الزيادة المتعلقة بالأقساط غير المستحقة بنسبة ما تم سداده.

المادة 7 - الكفالة التضامنية
يكفل الضامن {garant_nom} المشتري كفالة تضامنية في أداء جميع المبالغ المستحقة بموجب هذا العقد، من أصل وفوائد وغرامات. ويتنازل عن التجريد، ويعد مدينا أصليا.

المادة 8 - التسليم والضمان
تسلم السلع إلى عنوان المشتري أو تسلم بنقطة البيع في التاريخ المتفق عليه. وتطبق الضمانات القانونية، وضمان الصانع عند الاقتضاء، وفق القانون وشهادة التسليم الموقعة.

المادة 9 - المعطيات الشخصية
يعالج البائع المعطيات الشخصية المجمعة لغرض تدبير هذا العقد فقط، وفق القانون رقم 18-07 المؤرخ في 10 يونيو 2018 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي. وللمشتري حق الاطلاع والتصحيح والاعتراض وفق القانون.

المادة 10 - الاختصاص القضائي
تختص محاكم {ville} بالنظر في كل نزاع ناشئ عن هذا العقد.

حرر بـ {ville} بتاريخ {date_contrat} من نسختين.`;
