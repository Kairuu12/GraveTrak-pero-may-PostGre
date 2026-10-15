import json

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Grave,
    UserProfile,
    ColumbariumSlot, # Idinagdag ang import na ito
    Cemetery,
    CemeterySection,
    CemeteryPathway,
    Application,
    BurialApplication,
    FamilyCompositionMember,
    BurialDocument,
    BurialPlot,
    InterviewSchedule,
    StatusAuditLog,
    Notification,
    SystemSettings,
)
from .gis_validation import GeometryValidationError, validate_pathway_line, validate_section_polygon

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='username')
    role = serializers.SerializerMethodField()
    contact_number = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    preferences = serializers.SerializerMethodField()
    preferences_initialized = serializers.SerializerMethodField()
    notification_channels = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'role', 'contact_number', 'permissions', 'is_superuser', 'is_staff', 'is_active', 'last_login', 'preferences', 'preferences_initialized', 'notification_channels']

    def get_preferences(self, obj):
        from .user_preferences import get_preferences
        return get_preferences(obj)

    def get_preferences_initialized(self, obj):
        return bool(getattr(getattr(obj, 'profile', None), 'preferences', {}))

    def get_notification_channels(self, obj):
        from .notifications import normalize_ph_mobile
        from .sms_provider import sms_available
        number = normalize_ph_mobile(self.get_contact_number(obj))
        local = '0' + number[3:] if number else ''
        return {'sms_available': sms_available(), 'email_available': False, 'announcements_available': False,
                'sms_destination': local[:4] + '*****' + local[-2:] if local else ''}

    def get_role(self, obj):
        try:
            if hasattr(obj, 'profile') and obj.profile:
                return obj.profile.role
        except Exception:
            pass
        if obj.is_superuser:
            return 'admin'
        if obj.is_staff:
            return 'planning'
        return 'user'
        
    def get_contact_number(self, obj):
        try:
            if hasattr(obj, 'profile') and obj.profile:
                return getattr(obj.profile, 'contact_number', '')
        except Exception:
            pass
        return ''

    def get_permissions(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.permissions if profile else []


class UserUpdateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source='username', required=False)
    role = serializers.ChoiceField(choices=UserProfile.ROLE_CHOICES, required=False)
    contact_number = serializers.CharField(required=False, allow_blank=True)
    permissions = serializers.ListField(
        child=serializers.ChoiceField(choices=UserProfile.PERMISSION_CHOICES),
        required=False,
        allow_empty=True,
    )

    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'role', 'contact_number', 'permissions', 'is_active']
        extra_kwargs = {
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
            'is_active': {'required': False},
        }

    def update(self, instance, validated_data):
        profile_data = {}
        if 'role' in validated_data:
            profile_data['role'] = validated_data.pop('role')
        if 'contact_number' in validated_data:
            profile_data['contact_number'] = validated_data.pop('contact_number')
        if 'permissions' in validated_data:
            profile_data['permissions'] = validated_data.pop('permissions')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if 'username' in validated_data:
            instance.email = validated_data['username']

        instance.save()

        if profile_data:
            UserProfile.objects.update_or_create(
                user=instance,
                defaults=profile_data,
            )

        return instance


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=False, allow_blank=True)
    last_name = serializers.CharField(required=False, allow_blank=True)
    contact_number = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
        )
        UserProfile.objects.create(
            user=user, 
            role='user', 
            contact_number=validated_data.get('contact_number', '')
        )
        return user

    def validate_email(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value


class GraveSerializer(serializers.ModelSerializer):
    class Meta:
        model = Grave
        fields = ['id', 'grave_id', 'name', 'dates', 'location', 'status', 'latitude', 'longitude', 'notes', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class ColumbariumSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = ColumbariumSlot
        fields = ['id', 'section', 'floor', 'col', 'status', 'name', 'cemetery_map', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class CemeterySerializer(serializers.ModelSerializer):
    section_count = serializers.IntegerField(read_only=True)
    plot_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Cemetery
        fields = ['id', 'code', 'name', 'is_active', 'section_count', 'plot_count', 'boundary_geometry', 'created_at', 'updated_at']
        read_only_fields = ['id', 'boundary_geometry', 'created_at', 'updated_at']


class CemeterySectionSerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()
    total_plots = serializers.IntegerField(read_only=True, default=0)
    available_plots = serializers.IntegerField(read_only=True, default=0)
    occupied_plots = serializers.IntegerField(read_only=True, default=0)
    maintenance_plots = serializers.IntegerField(read_only=True, default=0)
    occupancy_percentage = serializers.SerializerMethodField()

    class Meta:
        model = CemeterySection
        fields = ['id', 'cemetery', 'name', 'legacy_source_name', 'zone_code', 'description', 'is_active', 'display_order', 'status', 'estimated_stack_height', 'layout_orientation', 'geometry', 'total_plots', 'available_plots', 'occupied_plots', 'maintenance_plots', 'occupancy_percentage', 'type', 'properties', 'created_at', 'updated_at']
        read_only_fields = ['id', 'type', 'properties', 'total_plots', 'available_plots', 'occupied_plots', 'maintenance_plots', 'occupancy_percentage', 'created_at', 'updated_at']
        extra_kwargs = {'zone_code': {'required': False, 'allow_blank': True}}
        # The database conditional constraint handles non-empty codes. DRF's
        # generated validator incorrectly makes the legacy blank code required.
        validators = []

    def validate(self, attrs):
        cemetery = attrs.get('cemetery', getattr(self.instance, 'cemetery', None))
        if self.instance and cemetery and self.instance.ground_plots.exclude(cemetery=cemetery).exists():
            raise serializers.ValidationError({'cemetery': 'This zone contains plots belonging to another cemetery.'})
        zone_code = attrs.get('zone_code', getattr(self.instance, 'zone_code', ''))
        name = attrs.get('name', getattr(self.instance, 'name', ''))
        if name and len(name.strip()) > 50:
            raise serializers.ValidationError({'name': 'Section names must be 50 characters or fewer to match niche records.'})
        if cemetery and name:
            duplicate_name = CemeterySection.objects.filter(cemetery=cemetery, name__iexact=name.strip())
            if self.instance:
                duplicate_name = duplicate_name.exclude(pk=self.instance.pk)
            if duplicate_name.exists():
                raise serializers.ValidationError({'name': 'This section name is already used in the selected cemetery.'})
        if self.instance and cemetery and name and name.strip().casefold() != self.instance.name.casefold():
            conflicting_slots = ColumbariumSlot.objects.filter(cemetery_map=cemetery.code, section__iexact=name.strip())
            if conflicting_slots.exists():
                raise serializers.ValidationError({'name': 'Niche records already use this section name in the selected cemetery.'})
        if cemetery and zone_code:
            duplicate = CemeterySection.objects.filter(cemetery=cemetery, zone_code=zone_code)
            if self.instance:
                duplicate = duplicate.exclude(pk=self.instance.pk)
            if duplicate.exists():
                raise serializers.ValidationError({'zone_code': 'This zone code is already used in the selected cemetery.'})
        geometry = attrs.get('geometry', getattr(self.instance, 'geometry', {}))
        if geometry:
            if not cemetery:
                raise serializers.ValidationError({'cemetery': 'A cemetery is required when saving section geometry.'})
            try:
                validate_section_polygon(geometry, cemetery.boundary_geometry)
            except GeometryValidationError as exc:
                raise serializers.ValidationError({'geometry': str(exc)}) from exc
        return attrs

    def get_type(self, obj):
        return 'Feature'

    def get_properties(self, obj):
        return {
            'id': obj.id,
            'cemetery': obj.cemetery_id,
            'cemetery_code': obj.cemetery.code if obj.cemetery else None,
            'name': obj.name,
            'legacy_source_name': obj.legacy_source_name,
            'zone_code': obj.zone_code,
            'description': obj.description,
            'is_active': obj.is_active,
            'display_order': obj.display_order,
            'status': obj.status,
            'estimated_stack_height': obj.estimated_stack_height,
            'layout_orientation': obj.layout_orientation,
            'total_floor_capacity': getattr(obj, 'total_plots', 0) * obj.estimated_stack_height,
            'available_floor_capacity': getattr(obj, 'available_plots', 0) * obj.estimated_stack_height,
            'total_plots': getattr(obj, 'total_plots', 0),
            'available_plots': getattr(obj, 'available_plots', 0),
            'occupied_plots': getattr(obj, 'occupied_plots', 0),
            'maintenance_plots': getattr(obj, 'maintenance_plots', 0),
            'occupancy_percentage': self.get_occupancy_percentage(obj),
            'has_geometry': bool(obj.geometry),
            'updated_at': obj.updated_at.isoformat() if obj.updated_at else None,
        }

    def get_occupancy_percentage(self, obj):
        total = getattr(obj, 'total_plots', 0)
        occupied = getattr(obj, 'occupied_plots', 0)
        return round((occupied / total) * 100, 1) if total else 0

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            'type': data['type'],
            'id': data['id'],
            'properties': data['properties'],
            'geometry': data['geometry'],
        }


class CemeteryPathwaySerializer(serializers.ModelSerializer):
    type = serializers.SerializerMethodField()
    properties = serializers.SerializerMethodField()

    class Meta:
        model = CemeteryPathway
        fields = ['id', 'cemetery', 'name', 'pathway_type', 'width_meters', 'description', 'is_active', 'geometry', 'type', 'properties', 'created_at', 'updated_at']
        read_only_fields = ['id', 'type', 'properties', 'created_at', 'updated_at']

    def validate(self, attrs):
        cemetery = attrs.get('cemetery', getattr(self.instance, 'cemetery', None))
        geometry = attrs.get('geometry', getattr(self.instance, 'geometry', {}))
        if not cemetery:
            raise serializers.ValidationError({'cemetery': 'A cemetery is required.'})
        try:
            validate_pathway_line(geometry, cemetery.boundary_geometry)
        except GeometryValidationError as exc:
            raise serializers.ValidationError({'geometry': str(exc)}) from exc
        return attrs

    def get_type(self, obj):
        return 'Feature'

    def get_properties(self, obj):
        return {
            'id': obj.id, 'cemetery': obj.cemetery_id, 'cemetery_code': obj.cemetery.code,
            'name': obj.name, 'pathway_type': obj.pathway_type,
            'width_meters': float(obj.width_meters), 'description': obj.description,
            'is_active': obj.is_active,
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {'type': data['type'], 'id': data['id'], 'properties': data['properties'], 'geometry': data['geometry']}


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = '__all__'


class BurialPlotSerializer(serializers.ModelSerializer):
    cemetery_code = serializers.CharField(source='cemetery.code', read_only=True)
    cemetery_name = serializers.CharField(source='cemetery.name', read_only=True)
    section_name = serializers.CharField(source='section_record.name', read_only=True)

    class Meta:
        model = BurialPlot
        fields = ['id', 'plot_id', 'cemetery', 'cemetery_code', 'cemetery_name', 'section_record', 'section_name', 'section', 'plot_number', 'status', 'location_description', 'latitude', 'longitude', 'updated_at']
        read_only_fields = ['id', 'cemetery_code', 'cemetery_name', 'section_name', 'updated_at']

    def validate(self, attrs):
        cemetery = attrs.get('cemetery', getattr(self.instance, 'cemetery', None))
        section_record = attrs.get('section_record', getattr(self.instance, 'section_record', None))
        if cemetery and section_record and section_record.cemetery_id != cemetery.id:
            raise serializers.ValidationError({'section_record': 'The selected section belongs to a different cemetery.'})
        return attrs


class BurialPlotDetailSerializer(BurialPlotSerializer):
    assigned_to_application = serializers.SerializerMethodField()

    class Meta:
        model = BurialPlot
        fields = BurialPlotSerializer.Meta.fields + ['assigned_to_application', 'notes']
        read_only_fields = BurialPlotSerializer.Meta.read_only_fields + ['assigned_to_application']

    def get_assigned_to_application(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.application_id
        return None


class BurialDocumentUploadSerializer(serializers.ModelSerializer):
    class Meta:
        model = BurialDocument
        fields = ['document_type', 'document_file']

    def validate_document_file(self, value):
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError('File too large. Maximum size is 10 MB.')
        return value


class BurialDocumentSerializer(serializers.ModelSerializer):
    document_type_display = serializers.CharField(source='get_document_type_display', read_only=True)
    document_file = serializers.SerializerMethodField()
    verified_by = serializers.StringRelatedField(read_only=True, allow_null=True)

    class Meta:
        model = BurialDocument
        fields = ['id', 'document_type', 'document_type_display', 'document_file', 'file_name', 'file_size', 'mime_type', 'verified', 'verification_status', 'verification_note', 'verified_by', 'verified_at', 'uploaded_at']
        read_only_fields = fields

    def get_document_file(self, obj):
        request = self.context.get('request')
        if obj.document_file:
            url = f'/api/burial-documents/{obj.pk}/download/'
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None


class InterviewScheduleSerializer(serializers.ModelSerializer):
    created_by = serializers.StringRelatedField(read_only=True, allow_null=True)
    
    class Meta:
        model = InterviewSchedule
        fields = ['id', 'scheduled_date', 'scheduled_time', 'duration_minutes', 'location', 'notes', 'required_documents', 'status', 'completed', 'completed_at', 'completion_notes', 'cancelled_at', 'cancellation_reason', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['id', 'status', 'completed', 'completed_at', 'cancelled_at', 'cancellation_reason', 'created_by', 'created_at', 'updated_at']


class StatusAuditLogSerializer(serializers.ModelSerializer):
    changed_by = serializers.StringRelatedField(read_only=True, allow_null=True)
    
    class Meta:
        model = StatusAuditLog
        fields = ['id', 'old_status', 'new_status', 'changed_by', 'changed_at', 'reason']
        read_only_fields = fields


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'application', 'notification_type', 'title', 'message', 'read', 'read_at', 'sent', 'sent_at', 'created_at']
        read_only_fields = fields


class SystemSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSettings
        fields = ['setting_key', 'setting_value', 'description', 'value_type', 'updated_at']
        read_only_fields = ['setting_key', 'description', 'value_type', 'updated_at']


class FamilyCompositionMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = FamilyCompositionMember
        fields = ['id', 'name', 'age', 'sex', 'civil_status', 'educational_attainment', 'occupation', 'income', 'relationship']
        read_only_fields = ['id']

    def validate_age(self, value):
        if value is not None and value > 130:
            raise serializers.ValidationError('Age must be between 0 and 130.')
        return value


class BurialApplicationCreateSerializer(serializers.ModelSerializer):
    family_members = serializers.CharField(write_only=True, required=False, default='[]')

    class Meta:
        model = BurialApplication
        fields = [
            'deceased_name',
            'deceased_date_of_birth',
            'place_of_birth',
            'deceased_date_of_death',
            'deceased_age',
            'deceased_gender',
            'applicant_name',
            'applicant_relationship',
            'applicant_contact_email',
            'applicant_contact_phone',
            'applicant_address',
            'client_age',
            'client_gender',
            'client_civil_status',
            'client_educational_attainment',
            'client_occupation',
            'client_income',
            'client_address',
            'funeral_home',
            'family_members',
        ]

        extra_kwargs = {
            'deceased_date_of_birth': {'required': True, 'allow_null': False},
            'place_of_birth': {'required': True, 'allow_null': False, 'allow_blank': False},
            'deceased_gender': {'required': True, 'allow_null': False},
            'funeral_home': {'required': True, 'allow_null': False, 'allow_blank': False},
            'client_age': {'required': True, 'allow_null': False},
            'client_gender': {'required': True, 'allow_null': False},
            'client_civil_status': {'required': True, 'allow_blank': False},
            'client_educational_attainment': {'required': True, 'allow_blank': False},
            'client_occupation': {'required': True, 'allow_blank': False},
            'client_income': {'required': True, 'allow_blank': False},
            'client_address': {'required': True, 'allow_blank': False},
        }

    def validate_client_age(self, value):
        if value > 130:
            raise serializers.ValidationError('Age must be between 0 and 130.')
        return value

    def validate(self, data):
        raw_family_members = data.get('family_members', '[]')
        try:
            family_members = json.loads(raw_family_members) if isinstance(raw_family_members, str) else raw_family_members
        except (TypeError, ValueError) as exc:
            raise serializers.ValidationError({'family_members': 'Family composition must be valid JSON.'}) from exc
        if not isinstance(family_members, list):
            raise serializers.ValidationError({'family_members': 'Family composition must be a list.'})
        member_serializer = FamilyCompositionMemberSerializer(data=family_members, many=True)
        member_serializer.is_valid(raise_exception=True)
        data['family_members'] = member_serializer.validated_data

        request = self.context.get('request')
        required_files = [
            'funeral_contract',
            'death_certificate',
            'deceased_valid_id',
            'valid_id',
            'indigency',
            'list_permit',
        ]
        uploaded_files = set(request.FILES.keys())
        missing = [field for field in required_files if field not in uploaded_files]
        if missing:
            raise serializers.ValidationError({'documents': f'Missing required documents: {", ".join(missing)}'})

        if data.get('deceased_date_of_death') and data['deceased_date_of_death'] > timezone.now().date():
            raise serializers.ValidationError({'deceased_date_of_death': 'Date of death cannot be in the future.'})

        if data.get('deceased_date_of_birth') and data['deceased_date_of_birth'] > timezone.now().date():
            raise serializers.ValidationError({'deceased_date_of_birth': 'Date of birth cannot be in the future.'})

        if data.get('deceased_date_of_birth') and data.get('deceased_date_of_death') and data['deceased_date_of_birth'] > data['deceased_date_of_death']:
            raise serializers.ValidationError({'deceased_date_of_birth': 'Date of birth cannot be after the date of death.'})

        if data.get('funeral_home', '').strip().lower() == 'others':
            raise serializers.ValidationError({'funeral_home': 'Enter the actual funeral home name.'})

        return data

    def create(self, validated_data):
        request = self.context.get('request')
        family_members = validated_data.pop('family_members', [])
        if request and request.user.is_authenticated:
            validated_data['submitted_by'] = request.user

        application = BurialApplication.objects.create(**validated_data)
        FamilyCompositionMember.objects.bulk_create([
            FamilyCompositionMember(application=application, **member) for member in family_members
        ])
        file_map = {
            'funeral_contract': BurialDocument.DocumentType.FUNERAL_CONTRACT,
            'death_certificate': BurialDocument.DocumentType.DEATH_CERTIFICATE,
            'deceased_valid_id': BurialDocument.DocumentType.DECEASED_VALID_ID,
            'indigency': BurialDocument.DocumentType.INDIGENCY,
            'list_permit': BurialDocument.DocumentType.LIST_PERMIT,
            'valid_id': BurialDocument.DocumentType.VALID_ID,
        }

        for field_name, document_type in file_map.items():
            upload = request.FILES.get(field_name)
            if upload:
                BurialDocument.objects.create(
                    application=application,
                    document_type=document_type,
                    document_file=upload,
                    uploaded_by=request.user if request.user.is_authenticated else None,
                )

        return application


class BurialApplicationListSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    interview_info = InterviewScheduleSerializer(source='interview_schedule', read_only=True)
    documents = BurialDocumentSerializer(many=True, read_only=True)
    document_completeness = serializers.ReadOnlyField()

    class Meta:
        model = BurialApplication
        fields = ['id', 'application_id', 'deceased_name', 'deceased_date_of_birth', 'place_of_birth', 'deceased_date_of_death', 'deceased_age', 'deceased_gender', 'funeral_home', 'applicant_name', 'applicant_address', 'applicant_contact_phone', 'applicant_contact_email', 'status', 'status_display', 'action_required_reason', 'rejection_reason', 'interview_info', 'documents', 'document_completeness', 'burial_date', 'burial_time', 'burial_location', 'submitted_at', 'approved_at', 'completed_at', 'created_at']
        read_only_fields = fields


class BurialApplicationDetailSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_plot_info = BurialPlotSerializer(source='assigned_plot', read_only=True)
    interview_info = InterviewScheduleSerializer(source='interview_schedule', read_only=True)
    documents = BurialDocumentSerializer(many=True, read_only=True)
    document_completeness = serializers.ReadOnlyField()
    family_members = FamilyCompositionMemberSerializer(many=True, read_only=True)

    class Meta:
        model = BurialApplication
        fields = [
            'id',
            'application_id',
            'status',
            'status_display',
            'deceased_name',
            'deceased_date_of_birth',
            'place_of_birth',
            'deceased_date_of_death',
            'deceased_age',
            'deceased_gender',
            'applicant_name',
            'applicant_relationship',
            'applicant_contact_email',
            'applicant_contact_phone',
            'applicant_address',
            'client_age',
            'client_gender',
            'client_civil_status',
            'client_educational_attainment',
            'client_occupation',
            'client_income',
            'client_address',
            'funeral_home',
            'family_members',
            'assigned_plot_info',
            'burial_date',
            'burial_time',
            'burial_location',
            'burial_executed_date',
            'burial_notes',
            'action_required_reason',
            'rejection_reason',
            'interview_info',
            'documents',
            'document_completeness',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class BurialApplicationMayorSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    assigned_plot_info = BurialPlotDetailSerializer(source='assigned_plot', read_only=True)
    interview_info = InterviewScheduleSerializer(source='interview_schedule', read_only=True)
    documents = BurialDocumentSerializer(many=True, read_only=True)
    status_history = StatusAuditLogSerializer(many=True, read_only=True)
    reviewed_by = serializers.StringRelatedField(read_only=True, allow_null=True)
    document_completeness = serializers.ReadOnlyField()
    family_members = FamilyCompositionMemberSerializer(many=True, read_only=True)

    class Meta:
        model = BurialApplication
        fields = [
            'id',
            'application_id',
            'status',
            'status_display',
            'deceased_name',
            'deceased_date_of_birth',
            'place_of_birth',
            'deceased_date_of_death',
            'deceased_age',
            'deceased_gender',
            'applicant_name',
            'applicant_relationship',
            'applicant_contact_email',
            'applicant_contact_phone',
            'applicant_address',
            'client_age',
            'client_gender',
            'client_civil_status',
            'client_educational_attainment',
            'client_occupation',
            'client_income',
            'client_address',
            'funeral_home',
            'family_members',
            'assigned_plot_info',
            'interview_info',
            'burial_date',
            'burial_time',
            'burial_location',
            'burial_executed_date',
            'burial_notes',
            'reviewed_by',
            'rejection_reason',
            'action_required_reason',
            'documents',
            'document_completeness',
            'status_history',
            'submitted_at',
            'approved_at',
            'completed_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class BurialApplicationResubmitSerializer(serializers.Serializer):
    new_documents = serializers.ListField(child=serializers.FileField(), required=True)
    notes = serializers.CharField(required=False, allow_blank=True)
